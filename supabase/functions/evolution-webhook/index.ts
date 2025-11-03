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

    // Si es un LID (Lidded ID), usar remoteJidAlt en su lugar
    let phoneToUse = rawJid;
    if (rawJid.includes('@lid')) {
      console.log('🔍 Detected LID format, checking for remoteJidAlt...');
      if (data.key?.remoteJidAlt) {
        phoneToUse = data.key.remoteJidAlt;
        console.log('✅ Using remoteJidAlt:', phoneToUse);
      } else {
        console.warn('⚠️ LID detected but no remoteJidAlt available');
      }
    }

    const normalizedPhone = normalizeArgentinePhone(phoneToUse);
    console.log('📞 Normalized:', { rawJid, phoneToUse, normalizedPhone });

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
            // Para LID, usar el remoteJid original; sino usar el número normalizado
            const chatId = data.key?.remoteJid?.includes('@lid')
              ? data.key.remoteJid
              : `${normalizedPhone}@s.whatsapp.net`;

            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "SupabaseFunction/1.0"
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

          const { data: { publicUrl } } = supabase
            .storage
            .from('payment-receipts')
            .getPublicUrl(filePath);

          const responseMessage = await processWithVendorBot(normalizedPhone, messageText || 'comprobante_recibido', publicUrl);

          if (responseMessage) {
            // Para LID, usar el remoteJid original; sino usar el número normalizado
            const chatId = data.key?.remoteJid?.includes('@lid')
              ? data.key.remoteJid
              : `${normalizedPhone}@s.whatsapp.net`;

            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

            await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "SupabaseFunction/1.0"
              },
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

    // --- Mensajes de audio: transcribir automáticamente con Baileys ---
    if (data.message?.audioMessage && !messageText) {
      console.log('🎤 Audio message received (Baileys), attempting transcription');
      console.log('Audio message structure:', JSON.stringify(data.message.audioMessage, null, 2));

      // Para LID, usar el remoteJid original; sino usar el número normalizado
      const chatId = data.key?.remoteJid?.includes('@lid')
        ? data.key.remoteJid
        : `${normalizedPhone}@s.whatsapp.net`;

      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      try {
        let audioBase64: string;
        let mimeType = data.message.audioMessage.mimetype || 'audio/ogg';

        // 1. Intentar obtener base64 directamente del webhook (si webhook_base64: true)
        if (data.message.audioMessage.base64) {
          console.log('✅ Using base64 directly from webhook');
          audioBase64 = data.message.audioMessage.base64;
        }
        // 2. Si no está en el webhook, usar el endpoint de Evolution API
        else {
          console.log('📥 Getting audio base64 from Evolution API endpoint');

          const audioBase64Resp = await fetch(
            `${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!
              },
              body: JSON.stringify({
                message: {
                  key: data.key,
                  message: data.message
                },
                convertToMp4: false
              })
            }
          );

          console.log('🔍 Audio base64 response status:', audioBase64Resp.status);

          if (!audioBase64Resp.ok) {
            const errorText = await audioBase64Resp.text();
            console.error('❌ Failed to get audio base64:', errorText);
            throw new Error('No se pudo obtener el audio en base64');
          }

          const audioResult = await audioBase64Resp.json();
          console.log('📦 Audio result structure:', JSON.stringify(audioResult, null, 2));

          if (!audioResult?.base64) {
            console.error('❌ No base64 in result');
            throw new Error('No se recibió el audio en formato base64');
          }

          audioBase64 = audioResult.base64;
        }

        console.log('✅ Audio base64 length:', audioBase64.length);

        // Transcribir el audio
        const transcriptionResp = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            audio: audioBase64,
            mimeType: mimeType
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
              headers: {
                'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "SupabaseFunction/1.0"
              },
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
          headers: {
            'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "SupabaseFunction/1.0"
          },
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
      // Para LID, usar el remoteJid original; sino usar el número normalizado
      const chatId = data.key?.remoteJid?.includes('@lid')
        ? data.key.remoteJid
        : `${normalizedPhone}@s.whatsapp.net`;

      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "SupabaseFunction/1.0"
        },
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

      // Para LID, usar el remoteJid original; sino usar el número normalizado
      const chatId = data.key?.remoteJid?.includes('@lid')
        ? data.key.remoteJid
        : `${normalizedPhone}@s.whatsapp.net`;

      console.log('📤 Sending to Evolution API:', { normalizedPhone, chatId, messagePreview: responseMessage.slice(0, 100) });

      try {
        const resp = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'apikey': evolutionApiKey!,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "SupabaseFunction/1.0"
          },
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
