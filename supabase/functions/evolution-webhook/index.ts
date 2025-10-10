import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { handleVendorBot } from './vendor-bot.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para normalizar números de teléfono argentinos
// Garantiza formato consistente: 549 + código de área + número (sin espacios ni caracteres especiales)
function normalizeArgentinePhone(phone: string): string {
  // IMPORTANTE: Primero eliminar la cadena @s.whatsapp.net completa
  let cleaned = phone.replace(/@s\.whatsapp\.net$/i, '');
  
  // Luego limpiar espacios, guiones, paréntesis, signos +, etc.
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, '');
  
  // Eliminar cualquier caracter no numérico que pueda quedar
  cleaned = cleaned.replace(/[^\d]/g, '');
  
  console.log(`🔧 Normalizing phone: "${phone}" -> cleaned: "${cleaned}"`);
  
  // Si ya tiene formato correcto 549XXXXXXXXXX (13 dígitos), retornar
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    return cleaned;
  }
  
  // Si tiene 54 sin el 9: 54XXXXXXXXXX (12 dígitos) -> agregar el 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    return '549' + cleaned.substring(2);
  }
  
  // Si empieza con 9: 9XXXXXXXXXX (11 dígitos) -> agregar 54
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    return '54' + cleaned;
  }
  
  // Si es número local sin código de país: XXXXXXXXXX (10 dígitos) -> agregar 549
  if (!cleaned.startsWith('54') && cleaned.length === 10) {
    return '549' + cleaned;
  }
  
  // Si tiene otros formatos, intentar extraer los últimos dígitos relevantes
  if (cleaned.length > 13) {
    const relevant = cleaned.slice(-13);
    return normalizeArgentinePhone(relevant);
  }
  
  // Si nada coincide, retornar tal cual (edge case)
  console.warn(`⚠️ Phone number could not be normalized: "${phone}" -> "${cleaned}"`);
  return cleaned;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Load authorized vendor numbers from environment
const vendorNumbers = (Deno.env.get('VENDOR_NUMBERS') || '').split(',').map(n => n.trim());

interface UserSession {
  phone: string;
  in_vendor_chat: boolean;
  assigned_vendor?: string;
  last_message_at: string;
  created_at: string;
}

async function getVendorData(phoneNumber: string): Promise<any> {
  // First check if it's in the hardcoded list
  if (vendorNumbers.includes(phoneNumber)) {
    // Get vendor data from database using phone or whatsapp_number
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .or(`phone.eq.${phoneNumber},whatsapp_number.eq.${phoneNumber}`)
      .single();
    
    return data || null;
  }
  
  // Otherwise check in database
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .or(`phone.eq.${phoneNumber},whatsapp_number.eq.${phoneNumber}`)
    .single();
    
  return data || null;
}

async function getOrCreateSession(phoneNumber: string): Promise<UserSession> {
  const { data: existing } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('phone', phoneNumber)
    .single();

  if (existing) {
    return existing as UserSession;
  }

  const newSession: UserSession = {
    phone: phoneNumber,
    in_vendor_chat: false,
    last_message_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  await supabase
    .from('user_sessions')
    .upsert(newSession, { onConflict: 'phone' });

  return newSession;
}

async function saveSession(session: UserSession): Promise<void> {
  await supabase
    .from('user_sessions')
    .upsert({
      ...session,
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'phone' });
}



async function processWithVendorBot(
  fromNumber: string, 
  messageText: string,
  imageUrl?: string
): Promise<string> {
  console.log('Processing with vendor bot:', { fromNumber, messageText, imageUrl });
  
  try {
    const response = await handleVendorBot(messageText, fromNumber, supabase, imageUrl);
    console.log('✅ Bot response:', response.substring(0, 100));
    return response;
  } catch (error) {
    console.error('❌ Exception calling vendor bot:', error);
    return 'Gracias por contactarnos. Un agente te responderá pronto.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Evolution webhook received:', JSON.stringify(body, null, 2));

    // Evolution API webhook structure for messages
    const event = body.event;
    const data = body.data;

    // Only process incoming messages
    if (event !== 'messages.upsert') {
      console.log('Ignoring non-message event:', event);
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Extract message details - data already contains key and message
    if (!data) {
      console.log('No data found');
      return new Response(JSON.stringify({ status: 'no_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Skip messages sent by the bot itself
    if (data.key?.fromMe) {
      console.log('Ignoring message from bot');
      return new Response(JSON.stringify({ status: 'ignored_own_message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const fromNumber = data.key?.remoteJid;
    
    // Extract message text from different message types
    const messageText = data.message?.conversation || 
                       data.message?.extendedTextMessage?.text ||
                       data.message?.imageMessage?.caption ||
                       data.message?.videoMessage?.caption ||
                       '';
    
    // Extract image URL if present
    const imageUrl = data.message?.imageMessage?.url || null;

    if (!fromNumber) {
      console.log('Missing phone number');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Limpiar y normalizar el número de teléfono
    const cleanPhone = fromNumber.replace(/@s\.whatsapp\.net$/i, '');
    const normalizedPhone = normalizeArgentinePhone(cleanPhone);
    console.log('Phone normalization:', cleanPhone, '->', normalizedPhone);

    const vendorData = await getVendorData(normalizedPhone);
    const session = await getOrCreateSession(normalizedPhone);

    // Si el usuario está esperando un comprobante y envía una imagen
    if (imageUrl && !vendorData) {
      const { data: userSession } = await supabase
        .from('user_sessions')
        .select('previous_state, last_bot_message')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      // Verificar si el usuario está en estado AWAITING_RECEIPT
      let isAwaitingReceipt = false;
      let pendingOrderId = null;
      
      if (userSession) {
        // El estado actual se guarda en previous_state
        isAwaitingReceipt = userSession.previous_state === 'AWAITING_RECEIPT';
        
        // También verificar en el contexto si hay un pending_order_id
        if (userSession.last_bot_message) {
          try {
            const context = JSON.parse(userSession.last_bot_message);
            pendingOrderId = context.pending_order_id;
            if (pendingOrderId) {
              isAwaitingReceipt = true;
            }
          } catch (e) {
            console.log('Could not parse session context');
          }
        }
      }
        
      if (isAwaitingReceipt) {
        console.log('Processing payment receipt image for:', normalizedPhone);
        
        try {
          // Descargar la imagen
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          
          // Generar nombre único para el archivo
          const fileName = `${normalizedPhone}-${Date.now()}.jpg`;
          const filePath = `receipts/${fileName}`;
          
          // Subir a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('payment-receipts')
            .upload(filePath, imageBlob, {
              contentType: 'image/jpeg',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Error uploading receipt:', uploadError);
            
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
            const chatId = `${normalizedPhone}@s.whatsapp.net`;
            
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!,
              },
              body: JSON.stringify({
                number: chatId,
                text: '❌ Hubo un error al procesar tu comprobante. Por favor, intenta enviarlo de nuevo.',
              }),
            });
            
            return new Response(JSON.stringify({ status: 'upload_error' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }
          
          // Obtener URL pública
          const { data: { publicUrl } } = supabase
            .storage
            .from('payment-receipts')
            .getPublicUrl(filePath);
          
          console.log('Receipt uploaded successfully:', publicUrl);
          
          // Procesar con el bot pasando la URL del comprobante
          const responseMessage = await processWithVendorBot(normalizedPhone, messageText || 'comprobante_recibido', publicUrl);
          
          if (responseMessage) {
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
            const chatId = `${normalizedPhone}@s.whatsapp.net`;
            
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!,
              },
              body: JSON.stringify({
                number: chatId,
                text: responseMessage,
              }),
            });
          }
          
          return new Response(JSON.stringify({ status: 'receipt_processed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
          
        } catch (error) {
          console.error('Error processing receipt:', error);
        }
      }
    }

    // If it's a media message without text, send a default response
    if (!messageText && (data.message?.audioMessage || data.message?.imageMessage || data.message?.videoMessage)) {
      console.log('Media message received without text, responding with default message');
      const defaultResponse = 'Recibí tu mensaje multimedia. Por favor envía un mensaje de texto para continuar.';
      
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
      
      // Usar número ya normalizado
      const chatId = `${normalizedPhone}@s.whatsapp.net`;
      
      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey!,
        },
        body: JSON.stringify({
          chatId: chatId,
          text: defaultResponse,
        }),
      });
      
      return new Response(JSON.stringify({ status: 'media_handled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (!messageText) {
      console.log('Missing message text');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Processing message from:', fromNumber, 'Message:', messageText);

    let responseMessage = '';

    if (vendorData) {
      console.log('Message from vendor:', normalizedPhone, 'Vendor ID:', vendorData.id);
      
      // Verificar si el vendedor quiere cerrar el chat y reactivar el bot
      const lowerMessage = messageText.toLowerCase().trim();
      if (lowerMessage === 'activar bot' || lowerMessage === 'bot activo' || lowerMessage === 'reactivar bot') {
        console.log('Vendor wants to activate bot, searching for active chats...');
        
        // Buscar chats activos de este vendedor
        const { data: activeChats, error: chatsError } = await supabase
          .from('vendor_chats')
          .select('id, customer_phone')
          .eq('vendor_id', vendorData.id)
          .eq('is_active', true);
        
        console.log('Active chats found:', activeChats?.length || 0, 'Error:', chatsError);
        
        if (activeChats && activeChats.length > 0) {
          console.log('Closing chats:', activeChats.map(c => c.customer_phone));
          
          // Cerrar todos los chats activos
          for (const chat of activeChats) {
            await supabase
              .from('vendor_chats')
              .update({ is_active: false, ended_at: new Date().toISOString() })
              .eq('id', chat.id);
            
            // Desactivar in_vendor_chat en user_sessions
            await supabase
              .from('user_sessions')
              .update({ 
                in_vendor_chat: false, 
                assigned_vendor_phone: null,
                updated_at: new Date().toISOString()
              })
              .eq('phone', chat.customer_phone);
            
            // Notificar al cliente
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
            const customerChatId = `${chat.customer_phone}@s.whatsapp.net`;
            
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!,
              },
              body: JSON.stringify({
                number: customerChatId,
                text: `✅ El vendedor cerró el chat directo.\n\n🤖 El bot está activo nuevamente.\n\nEscribe "menu" para ver las opciones.`,
              }),
            });
          }
          
          console.log('Bot activated successfully');
          // Notificar al vendedor
          responseMessage = `✅ Chat directo cerrado.\n\n🤖 El bot está activo nuevamente para los clientes.`;
        } else {
          responseMessage = `ℹ️ No hay chats directos activos en este momento.`;
        }
      } else {
        // Buscar si hay chats activos para este vendedor
        const { data: activeChats } = await supabase
          .from('vendor_chats')
          .select('id, customer_phone')
          .eq('vendor_id', vendorData.id)
          .eq('is_active', true);
        
        if (activeChats && activeChats.length > 0) {
          // Enviar mensaje del vendedor a todos los clientes en chat activo
          const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
          const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
          const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
          
          for (const chat of activeChats) {
            // Guardar mensaje en chat_messages
            await supabase
              .from('chat_messages')
              .insert({
                chat_id: chat.id,
                sender_type: 'vendor',
                message: messageText
              });
            
            // Enviar mensaje al cliente
            const customerChatId = `${chat.customer_phone}@s.whatsapp.net`;
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!,
              },
              body: JSON.stringify({
                number: customerChatId,
                text: `💬 *${vendorData.name}*: ${messageText}`,
              }),
            });
          }
          
          responseMessage = ''; // No responder al vendedor, solo reenviar
        } else {
          // No hay chats activos, procesar con el bot normal
          responseMessage = await processWithVendorBot(normalizedPhone, messageText);
        }
      }
    } else {
      // Customer message
      
      // Primero, verificar si hay un pedido activo para este cliente
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('id, vendor_id')
        .eq('customer_phone', normalizedPhone)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Guardar mensaje del cliente en la tabla messages si tiene pedido activo
      if (activeOrder) {
        console.log('Customer has active order, saving message to messages table');
        await supabase
          .from('messages')
          .insert({
            order_id: activeOrder.id,
            sender: 'customer',
            content: messageText,
            is_read: false
          });
      }
      
      if (session.in_vendor_chat && session.assigned_vendor_phone) {
        // Customer is chatting with vendor - save message for vendor to see
        console.log('Customer in vendor chat with vendor:', session.assigned_vendor_phone);
        
        // Find the active vendor chat
        const { data: vendorChat } = await supabase
          .from('vendor_chats')
          .select('id')
          .eq('customer_phone', normalizedPhone)
          .eq('is_active', true)
          .single();
        
        if (vendorChat) {
          // Save customer message to chat_messages
          await supabase
            .from('chat_messages')
            .insert({
              chat_id: vendorChat.id,
              sender_type: 'customer',
              message: messageText
            });
          
          console.log('Customer message saved to vendor chat');
        }
        
        // Bot stays silent
        return new Response(JSON.stringify({ status: 'vendor_chat_active' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } else {
        // Process with bot
        responseMessage = await processWithVendorBot(normalizedPhone, messageText);
      }
    }

    // Send response back via Evolution API
    if (responseMessage) {
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      // Usar el número normalizado para enviar respuesta
      const chatId = `${normalizedPhone}@s.whatsapp.net`;

      console.log('📤 Original JID:', data.key.remoteJid);
      console.log('📤 Normalized phone:', normalizedPhone);
      console.log('📤 Final chatId:', chatId);
      console.log('📤 Sending message to Evolution API...');

      try {
        const evolutionResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey!,
          },
          body: JSON.stringify({
            number: chatId,
            text: responseMessage,
          }),
        });

        const responseData = await evolutionResponse.json();
        console.log('✅ Evolution API response:', JSON.stringify(responseData));
        
        if (!evolutionResponse.ok) {
          console.error('❌ Evolution API error:', evolutionResponse.status, responseData);
        }
      } catch (error) {
        console.error('❌ Error sending message to Evolution API:', error);
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
