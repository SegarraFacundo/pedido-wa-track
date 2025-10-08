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
  // Limpiar el número: remover espacios, guiones, paréntesis, @s.whatsapp.net, etc.
  let cleaned = phone.replace(/[\s\-\(\)\+@s\.whatsapp\.net]/g, '');
  
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

async function isVendor(phoneNumber: string): Promise<boolean> {
  if (vendorNumbers.includes(phoneNumber)) {
    return true;
  }
  
  const { data } = await supabase
    .from('vendors')
    .select('whatsapp_number')
    .eq('whatsapp_number', phoneNumber)
    .single();
    
  return !!data;
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
  messageText: string
): Promise<string> {
  console.log('Processing with vendor bot:', { fromNumber, messageText });
  
  try {
    const response = await handleVendorBot(messageText, fromNumber, supabase);
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

    if (!fromNumber) {
      console.log('Missing phone number');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // If it's a media message without text, send a default response
    if (!messageText && (data.message?.audioMessage || data.message?.imageMessage || data.message?.videoMessage)) {
      console.log('Media message received without text, responding with default message');
      const defaultResponse = 'Recibí tu mensaje multimedia. Por favor envía un mensaje de texto para continuar.';
      
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
      
      // Normalizar número para WhatsApp
      const cleanPhone = fromNumber.replace(/@s\.whatsapp\.net$/i, '');
      const normalizedPhone = normalizeArgentinePhone(cleanPhone);
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

    // Limpiar y normalizar el número de teléfono
    const cleanPhone = fromNumber.replace(/@s\.whatsapp\.net$/i, '');
    const normalizedPhone = normalizeArgentinePhone(cleanPhone);
    console.log('Phone normalization:', cleanPhone, '->', normalizedPhone);

    const vendorStatus = await isVendor(normalizedPhone);
    const session = await getOrCreateSession(normalizedPhone);

    let responseMessage = '';

    if (vendorStatus) {
      console.log('Message from vendor:', normalizedPhone);
      // Vendor messages - could be handled differently
      responseMessage = await processWithVendorBot(normalizedPhone, messageText);
    } else {
      // Customer message
      if (session.in_vendor_chat && session.assigned_vendor) {
        // Customer is chatting with vendor - stay silent
        console.log('Customer in vendor chat, staying silent');
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
