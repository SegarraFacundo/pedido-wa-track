import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { handleVendorBot } from './vendor-bot.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Normaliza números argentinos: siempre 549XXXXXXXXX
function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/@s\.whatsapp\.net$/i, '').replace(/@c\.us$/i, '');
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, '');
  cleaned = cleaned.replace(/[^\d]/g, '');

  console.log(`🔧 Normalizing: "${phone}" -> "${cleaned}"`);

  if (cleaned.startsWith('549') && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    cleaned = '549' + cleaned.slice(2);
  }
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    cleaned = '54' + cleaned;
  }
  if (cleaned.length === 10 && !cleaned.startsWith('54')) {
    cleaned = '549' + cleaned;
  }
  if (cleaned.length > 13) {
    const last10 = cleaned.slice(-10);
    cleaned = '549' + last10;
  }

  if (!cleaned.startsWith('549') || cleaned.length !== 13) {
    console.warn(`⚠️ Number not normalized cleanly: ${cleaned}`);
  }

  return cleaned;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const vendorNumbers = (Deno.env.get('VENDOR_NUMBERS') || '').split(',').map(n => n.trim());

interface UserSession {
  phone: string;
  in_vendor_chat: boolean;
  assigned_vendor?: string;
  last_message_at: string;
  created_at: string;
}

// --- UTILITIES ---

async function getVendorData(phoneNumber: string): Promise<any> {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .or(`phone.eq.${phoneNumber},whatsapp_number.eq.${phoneNumber}`)
    .maybeSingle();
  return data || null;
}

async function getOrCreateSession(phoneNumber: string): Promise<UserSession> {
  const { data: existing } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('phone', phoneNumber)
    .maybeSingle();

  if (existing) return existing as UserSession;

  const newSession: UserSession = {
    phone: phoneNumber,
    in_vendor_chat: false,
    last_message_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  await supabase.from('user_sessions').upsert(newSession, { onConflict: 'phone' });
  return newSession;
}

async function processWithVendorBot(
  fromNumber: string,
  messageText: string,
  imageUrl?: string
): Promise<string> {
  console.log('🤖 Bot input:', { fromNumber, messageText, imageUrl });
  try {
    const response = await handleVendorBot(messageText, fromNumber, supabase);
    console.log('✅ Bot response (preview):', response?.slice(0, 100));
    return response;
  } catch (err) {
    console.error('❌ Bot exception:', err);
    return 'Gracias por contactarnos. Un agente te responderá pronto.';
  }
}

// --- MAIN SERVER ---

serve(async (req) => {
  console.log('🎯 Webhook called - Method:', req.method, 'URL:', req.url);
  
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log('📦 Webhook body received:', JSON.stringify(body, null, 2));
    
    const event = body.event;
    const data = body.data;

    if (event !== 'messages.upsert' || !data) {
      console.log('Ignoring non-message event or missing data');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (data.key?.fromMe) {
      console.log('Ignoring message from bot itself');
      return new Response(JSON.stringify({ status: 'own_message_ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const rawJid = data.key?.remoteJid;
    if (!rawJid) {
      console.log('❌ Missing remoteJid');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const normalizedPhone = normalizeArgentinePhone(rawJid);
    console.log('📞 Normalized:', { rawJid, normalizedPhone });

    const messageText = data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      data.message?.videoMessage?.caption || '';

    const imageUrl = data.message?.imageMessage?.url || null;

    const vendorData = await getVendorData(normalizedPhone);
    const session = await getOrCreateSession(normalizedPhone);

    // --- Si el usuario envía comprobante ---
    if (imageUrl && !vendorData) {
      const { data: userSession } = await supabase
        .from('user_sessions')
        .select('previous_state, last_bot_message')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      let isAwaitingReceipt = false;
      let pendingOrderId = null;
      
      if (userSession) {
        isAwaitingReceipt = userSession.previous_state === 'AWAITING_RECEIPT';
        if (userSession.last_bot_message) {
          try {
            const context = JSON.parse(userSession.last_bot_message);
            pendingOrderId = context.pending_order_id;
            if (pendingOrderId) isAwaitingReceipt = true;
          } catch (e) {
            console.log('Could not parse session context');
          }
        }
      }
        
      if (isAwaitingReceipt) {
        console.log('Processing payment receipt image for:', normalizedPhone);
        
        try {
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          const fileName = `${normalizedPhone}-${Date.now()}.jpg`;
          const filePath = `receipts/${fileName}`;
          
          const { error: uploadError } = await supabase
            .storage
            .from('payment-receipts')
            .upload(filePath, imageBlob, {
              contentType: 'image/jpeg',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Error uploading receipt:', uploadError);
            const chatId = data.key?.remoteJid?.includes('@lid') || data.key?.remoteJid?.includes(':')
              ? data.key.remoteJid.replace(/(:\d+)?@lid$/, '@s.whatsapp.net')
              : `${normalizedPhone}@s.whatsapp.net`;

            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
            
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
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
          
          const { data: { publicUrl } } = supabase
            .storage
            .from('payment-receipts')
            .getPublicUrl(filePath);
          
          const responseMessage = await processWithVendorBot(normalizedPhone, messageText || 'comprobante_recibido', publicUrl);
          
          if (responseMessage) {
            const chatId = data.key?.remoteJid?.includes('@lid') || data.key?.remoteJid?.includes(':')
              ? data.key.remoteJid.replace(/(:\d+)?@lid$/, '@s.whatsapp.net')
              : `${normalizedPhone}@s.whatsapp.net`;

            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
            
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
              body: JSON.stringify({ number: chatId, text: responseMessage }),
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

    // --- Mensajes de audio: transcribir automáticamente ---
    if (data.message?.audioMessage && !messageText) {
      console.log('🎤 Audio message received, attempting transcription');
      
      const chatId = data.key?.remoteJid?.includes('@lid') || data.key?.remoteJid?.includes(':')
        ? data.key.remoteJid.replace(/(:\d+)?@lid$/, '@s.whatsapp.net')
        : `${normalizedPhone}@s.whatsapp.net`;

      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      try {
        // Obtener el mensaje completo con la URL del audio
        const messageId = data.key?.id;
        console.log('📥 Fetching audio from Evolution API:', messageId);
        
        const audioDetailsResp = await fetch(
          `${evolutionApiUrl}/chat/findMessages/${instanceName}`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'apikey': evolutionApiKey! 
            },
            body: JSON.stringify({
              where: {
                key: {
                  id: messageId
                }
              }
            })
          }
        );

        const audioDetails = await audioDetailsResp.json();
        console.log('🔍 Audio details response:', JSON.stringify(audioDetails).slice(0, 200));
        
        // Intentar obtener base64 directamente o URL
        let audioBase64 = null;
        let audioUrl = null;
        
        if (audioDetails?.message?.audioMessage) {
          const audioMsg = audioDetails.message.audioMessage;
          audioBase64 = audioMsg.ptt || audioMsg.audio;
          audioUrl = audioMsg.url;
        } else if (Array.isArray(audioDetails) && audioDetails[0]?.message?.audioMessage) {
          const audioMsg = audioDetails[0].message.audioMessage;
          audioBase64 = audioMsg.ptt || audioMsg.audio;
          audioUrl = audioMsg.url;
        }

        if (!audioBase64 && audioUrl) {
          console.log('📥 Downloading audio from URL:', audioUrl);
          const audioResponse = await fetch(audioUrl);
          const audioBlob = await audioResponse.blob();
          const audioArrayBuffer = await audioBlob.arrayBuffer();
          const audioBytes = new Uint8Array(audioArrayBuffer);
          
          // Convert to base64
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < audioBytes.length; i += chunkSize) {
            const chunk = audioBytes.subarray(i, Math.min(i + chunkSize, audioBytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          audioBase64 = btoa(binary);
        }

        if (!audioBase64) {
          throw new Error('No se pudo obtener el audio');
        }

        console.log('🎯 Audio base64 length:', audioBase64.length);
        
        // Transcribir el audio
        const transcriptionResp = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            audio: audioBase64,
            mimeType: 'audio/ogg'
          })
        });

        const transcriptionData = await transcriptionResp.json();
        console.log('📝 Transcription result:', transcriptionData);

        if (transcriptionData.text) {
          // Procesar el texto transcrito con el bot
          const responseMessage = await processWithVendorBot(normalizedPhone, transcriptionData.text);
          
          if (responseMessage) {
            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
              body: JSON.stringify({ number: chatId, text: responseMessage }),
            });
          }

          return new Response(JSON.stringify({ status: 'audio_transcribed', text: transcriptionData.text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        } else {
          throw new Error('No se pudo transcribir el audio');
        }

      } catch (error) {
        console.error('❌ Error transcribing audio:', error);
        
        // Enviar mensaje de error al usuario
        await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
          body: JSON.stringify({ 
            number: chatId, 
            text: 'Lo siento, no pude entender tu mensaje de voz. Por favor, intenta enviarlo de nuevo o escribe tu mensaje.' 
          }),
        });

        return new Response(JSON.stringify({ status: 'transcription_error', error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    // --- Otros mensajes multimedia sin texto ---
    if (!messageText && (data.message?.imageMessage || data.message?.videoMessage)) {
      const defaultResponse = 'Recibí tu mensaje multimedia. Por favor envía un mensaje de texto para continuar.';
      const chatId = data.key?.remoteJid?.includes('@lid') || data.key?.remoteJid?.includes(':')
        ? data.key.remoteJid.replace(/(:\d+)?@lid$/, '@s.whatsapp.net')
        : `${normalizedPhone}@s.whatsapp.net`;

      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
        body: JSON.stringify({ number: chatId, text: defaultResponse }),
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

    console.log('Processing message from:', normalizedPhone, 'Message:', messageText);
    
    // Procesar mensaje con el bot de IA
    let responseMessage = await processWithVendorBot(normalizedPhone, messageText);
    
    // --- ENVÍO FINAL ---
    if (responseMessage) {
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      // ✅ Fix universal: compatibilidad con JIDs @lid o multi-device
      const chatId =
        data.key?.remoteJid?.includes('@lid') || data.key?.remoteJid?.includes(':')
          ? data.key.remoteJid.replace(/(:\d+)?@lid$/, '@s.whatsapp.net')
          : `${normalizedPhone}@s.whatsapp.net`;

      console.log('📤 Sending to Evolution API:', { normalizedPhone, chatId, messagePreview: responseMessage.slice(0, 100) });

      try {
        const resp = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey! },
          body: JSON.stringify({ number: chatId, text: responseMessage }),
        });

        const respData = await resp.json();
        console.log('✅ Evolution API response:', respData);

        if (!resp.ok) console.error('❌ Evolution API error response:', respData);
      } catch (err) {
        console.error('❌ Evolution send error:', err);
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
