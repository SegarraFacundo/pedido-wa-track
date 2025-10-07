import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function handleVendorBot(
  fromNumber: string, 
  messageText: string
): Promise<string> {
  console.log('Processing with vendor bot:', { fromNumber, messageText });
  
  try {
    const { data, error } = await supabase.functions.invoke('twilio-webhook/vendor-bot', {
      body: { 
        phone: fromNumber,
        message: messageText 
      }
    });

    if (error) {
      console.error('Error calling vendor bot:', error);
      return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente.';
    }

    return data?.response || 'Gracias por tu mensaje. ¿En qué puedo ayudarte?';
  } catch (error) {
    console.error('Exception calling vendor bot:', error);
    return 'Gracias por contactarnos. Un agente te responderá pronto.';
  }
}

async function jidToPhoneWithAR9(remoteJid: string | undefined): Promise<string | null> {
  const jid = String(remoteJid || "");
  const base = jid.replace(/@(s\.whatsapp\.net|g\.us)$/i, "");

  // Si es grupo, no hay número directo
  if (/@g\.us$/i.test(jid)) return null;

  // Ya viene con 549 -> devolver tal cual
  if (base.startsWith("549")) return base;

  // Si viene como 54... (sin 9) y parece móvil, insertamos el 9
  if (base.startsWith("54") && !base.startsWith("549")) {
    // Heurística simple: largo >= 11 suele indicar línea móvil/área + número
    if (base.length >= 11) {
      return "549" + base.slice(2);
    }
  }

  // Otros países o casos raros
  return base;
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

    const fromNumber = await jidToPhoneWithAR9(data.key?.remoteJid);
    const messageText = data.message?.conversation || 
                       data.message?.extendedTextMessage?.text || '';

    if (!fromNumber || !messageText) {
      console.log('Missing phone number or message text');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Processing message from:', fromNumber, 'Message:', messageText);

    const vendorStatus = await isVendor(fromNumber);
    const session = await getOrCreateSession(fromNumber);

    let responseMessage = '';

    if (vendorStatus) {
      console.log('Message from vendor:', fromNumber);
      // Vendor messages - could be handled differently
      responseMessage = await handleVendorBot(fromNumber, messageText);
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
        responseMessage = await handleVendorBot(fromNumber, messageText);
      }
    }

    // Send response back via Evolution API
    if (responseMessage) {
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      // Ensure the number has the correct format for Argentina (add 9 after 54 if missing)
      let formattedNumber = fromNumber;
      if (fromNumber.startsWith('54') && fromNumber.length >= 12 && !fromNumber.startsWith('549')) {
        formattedNumber = '549' + fromNumber.substring(2);
      }

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey!,
        },
        body: JSON.stringify({
          number: formattedNumber,
          text: responseMessage,
        }),
      });
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
