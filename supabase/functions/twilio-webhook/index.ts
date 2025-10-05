import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleVendorBot } from './vendor-bot.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Lista de números de vendedores autorizados
const VENDOR_NUMBERS = (Deno.env.get('VENDOR_NUMBERS') || '')
  .split(',')
  .map(n => n.trim())
  .filter(Boolean);

interface UserSession {
  phone: string;
  in_vendor_chat: boolean;
  assigned_vendor_phone?: string | null;
  last_bot_message?: string | null;
  previous_state?: string | null;
  updated_at: string;
}

// Helper para crear respuesta TwiML
function createTwiMLResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message><![CDATA[${message}]]></Message>
</Response>`;
  return new Response(twiml, {
    headers: { ...corsHeaders, 'Content-Type': 'text/xml; charset=utf-8' },
    status: 200
  });
}

// Verificar si un número es vendedor
async function isVendor(phone: string): Promise<boolean> {
  if (!phone) return false;
  const normalized = phone.trim();
  
  // Verificar en lista de números
  if (VENDOR_NUMBERS.includes(normalized)) return true;

  // Verificar en base de datos
  try {
    const { data } = await supabase
      .from('vendors')
      .select('phone')
      .eq('phone', normalized)
      .limit(1);
    return !!(data && data.length > 0);
  } catch (e) {
    console.warn('Error verificando vendedor:', e);
    return false;
  }
}

// Obtener o crear sesión de usuario
async function getOrCreateSession(phone: string): Promise<UserSession> {
  if (!phone) {
    return {
      phone: '',
      in_vendor_chat: false,
      updated_at: new Date().toISOString()
    };
  }

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .upsert({
        phone: phone,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })
      .select()
      .single();

    if (error) throw error;
    return data as UserSession;
  } catch (e) {
    console.error('Error obteniendo sesión:', e);
    // Fallback en memoria
    return {
      phone: phone,
      in_vendor_chat: false,
      updated_at: new Date().toISOString()
    };
  }
}

// Guardar sesión
async function saveSession(session: UserSession): Promise<void> {
  try {
    session.updated_at = new Date().toISOString();
    await supabase
      .from('user_sessions')
      .upsert(session, { onConflict: 'phone' });
  } catch (e) {
    console.error('Error guardando sesión:', e);
  }
}

// Encontrar cliente asignado a un vendedor
async function findClientForVendor(vendorPhone: string): Promise<UserSession | null> {
  try {
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('in_vendor_chat', true)
      .eq('assigned_vendor_phone', vendorPhone)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    return data as UserSession | null;
  } catch (e) {
    return null;
  }
}

// Notificar a vendedores (webhook, notificación push, etc)
async function notifyVendors(customerPhone: string, message: string): Promise<void> {
  try {
    // Obtener primer vendedor activo
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, phone, whatsapp_number')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!vendor) return;

    // Registrar notificación
    await supabase
      .from('vendor_notifications')
      .insert({
        vendor_id: vendor.id,
        customer_phone: customerPhone,
        message: message,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    // TODO: Enviar mensaje de WhatsApp al vendedor si está configurado
    console.log('Vendedor notificado:', vendor.phone);
  } catch (e) {
    console.error('Error notificando vendedor:', e);
  }
}

// Comandos de escape rápidos
function getQuickCommand(text: string): string | null {
  const t = text.toLowerCase().trim();
  
  // Comandos para pedir vendedor
  if (/\b(vendedor|humano|persona|asistencia|ayuda personalizada)\b/.test(t)) {
    return 'REQUEST_VENDOR';
  }
  
  // Comandos para volver al bot
  if (t === 'sigue bot' || t === 'volver bot' || t === 'bot') {
    return 'RESUME_BOT';
  }
  
  // Comandos de menú
  if (t === 'menu' || t === 'inicio' || t === 'empezar') {
    return 'MENU';
  }
  
  if (t === 'estado' || t === 'mi pedido') {
    return 'STATUS';
  }
  
  if (t === 'ayuda' || t === 'help') {
    return 'HELP';
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse incoming data
    const contentType = req.headers.get('content-type') || '';
    let phoneNumber = '';
    let message = '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Formato Twilio webhook
      const formData = await req.formData();
      phoneNumber = (formData.get('From') || '').toString().replace('whatsapp:', '');
      message = (formData.get('Body') || '').toString();
    } else {
      // Formato JSON
      const body = await req.json();
      phoneNumber = (body?.phoneNumber || '').toString().trim();
      message = (body?.message || '').toString();
    }

    if (!phoneNumber) {
      return createTwiMLResponse('Error: número de teléfono no proporcionado');
    }

    console.log('Mensaje recibido:', { phoneNumber, message: message.substring(0, 50) });

    const senderIsVendor = await isVendor(phoneNumber);
    const session = await getOrCreateSession(phoneNumber);

    // CASO 1: Vendedor quiere devolver control al bot
    if (senderIsVendor) {
      const command = getQuickCommand(message);
      
      if (command === 'RESUME_BOT') {
        // Buscar cliente asignado a este vendedor
        const clientSession = await findClientForVendor(phoneNumber);
        
        if (!clientSession) {
          return createTwiMLResponse('No hay conversaciones activas asignadas a ti para reanudar.');
        }

        // Reactivar bot para el cliente
        clientSession.in_vendor_chat = false;
        clientSession.assigned_vendor_phone = null;
        await saveSession(clientSession);

        const resumeMsg = clientSession.last_bot_message || 
                         'El bot ha sido reactivado y continuará donde quedó.';

        // TODO: Enviar mensaje al cliente indicando que el bot retomó
        console.log('Bot reactivado para:', clientSession.phone);

        return createTwiMLResponse(`✅ Bot reactivado para ${clientSession.phone}\n\nÚltimo mensaje: "${resumeMsg}"`);
      }

      // Si es vendedor pero no es comando de control, no procesamos
      return createTwiMLResponse('👋 Eres un vendedor. Para devolver el control al bot, escribe "sigue bot"');
    }

    // CASO 2: Cliente solicita hablar con vendedor
    const quickCommand = getQuickCommand(message);
    
    if (quickCommand === 'REQUEST_VENDOR') {
      // Marcar sesión como en chat con vendedor
      session.in_vendor_chat = true;
      session.previous_state = 'active';
      await saveSession(session);

      // Notificar a vendedores
      await notifyVendors(phoneNumber, `Cliente ${phoneNumber} solicita asistencia: "${message}"`);

      return createTwiMLResponse(
        `✅ *Solicitaste hablar con un vendedor*\n\n` +
        `Un miembro de nuestro equipo te atenderá pronto.\n\n` +
        `💬 Puedes seguir escribiendo y el vendedor verá tus mensajes.\n\n` +
        `Para volver al bot automático, escribe "sigue bot"`
      );
    }

    // CASO 3: Cliente está en chat con vendedor - no responder
    if (session.in_vendor_chat) {
      // El mensaje queda registrado en la conversación pero el bot no responde
      console.log('Cliente en chat con vendedor, bot silenciado');
      
      // Registrar mensaje para el vendedor
      await supabase
        .from('customer_messages')
        .insert({
          customer_phone: phoneNumber,
          message: message,
          created_at: new Date().toISOString()
        })
        .then(() => {
          console.log('Mensaje guardado para vendedor');
        })
        .catch(e => {
          console.error('Error guardando mensaje:', e);
        });

      // Retornar respuesta vacía (no enviar nada al cliente)
      return new Response('', { headers: corsHeaders, status: 200 });
    }

    // CASO 4: Comandos rápidos de menú
    if (quickCommand === 'MENU') {
      const menuMsg = await handleVendorBot('menu', phoneNumber, supabase);
      session.last_bot_message = menuMsg;
      await saveSession(session);
      return createTwiMLResponse(menuMsg);
    }

    if (quickCommand === 'STATUS') {
      const statusMsg = await handleVendorBot('estado', phoneNumber, supabase);
      session.last_bot_message = statusMsg;
      await saveSession(session);
      return createTwiMLResponse(statusMsg);
    }

    if (quickCommand === 'HELP') {
      return createTwiMLResponse(
        `📚 *Centro de Ayuda*\n\n` +
        `💡 *Comandos útiles:*\n` +
        `• "menu" - Ver menú principal\n` +
        `• "estado" - Ver tus pedidos\n` +
        `• "vendedor" - Hablar con alguien\n` +
        `• "ofertas" - Ver promociones\n\n` +
        `🔗 Documentación completa: lovable.app/ayuda`
      );
    }

    // CASO 5: Flujo normal del bot
    try {
      const botReply = await handleVendorBot(message, phoneNumber, supabase);
      
      // Guardar último mensaje del bot
      session.last_bot_message = botReply;
      await saveSession(session);

      return createTwiMLResponse(botReply);
    } catch (botError) {
      console.error('Error en handleVendorBot:', botError);
      
      return createTwiMLResponse(
        `😕 Hubo un problema procesando tu mensaje.\n\n` +
        `💡 *Opciones:*\n` +
        `• Escribe "menu" para ver opciones\n` +
        `• Escribe "vendedor" para hablar con alguien`
      );
    }

  } catch (error) {
    console.error('Error en webhook principal:', error);
    
    return createTwiMLResponse(
      `❌ Error del sistema.\n\n` +
      `Escribe "vendedor" para asistencia o intenta más tarde.`
    );
  }
});