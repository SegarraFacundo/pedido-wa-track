import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { handleVendorBot } from './vendor-bot.ts';
import { processWithDebounce, releaseLock } from './message-buffer.ts';

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
    const response = await handleVendorBot(messageText, fromNumber, supabase, imageUrl);
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
      data.message?.videoMessage?.caption ||
      data.message?.documentMessage?.caption || '';

    // Detectar tanto imágenes como documentos (PDFs) para comprobantes
    const imageUrl = data.message?.imageMessage?.url || null;
    const documentUrl = data.message?.documentMessage?.url || null;
    const documentMimeType = data.message?.documentMessage?.mimetype || null;
    const documentFileName = data.message?.documentMessage?.fileName || null;

    // 📍 Detectar si el usuario envió su ubicación
    const locationMessage = data.message?.locationMessage;
    if (locationMessage) {
      console.log('📍 Location received:', locationMessage);
      
      const latitude = locationMessage.degreesLatitude;
      const longitude = locationMessage.degreesLongitude;
      
      // 🗺️ Hacer geocodificación inversa usando OpenStreetMap Nominatim
      let realAddress = '';
      try {
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'LapachodApp/1.0'
            }
          }
        );
        
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          console.log('📍 Geocoding result:', geocodeData);
          
          // Construir dirección desde los componentes
          const addr = geocodeData.address;
          const parts = [];
          
          if (addr.road) parts.push(addr.road);
          if (addr.house_number) parts.push(addr.house_number);
          if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
          if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
          if (addr.state) parts.push(addr.state);
          
          realAddress = parts.join(', ');
          console.log('✅ Geocoded address:', realAddress);
        }
      } catch (geocodeError) {
        console.error('Error geocoding location:', geocodeError);
      }
      
      // Si no se pudo geocodificar, usar coordenadas como fallback
      if (!realAddress) {
        realAddress = `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`;
      }
      
      // Guardar ubicación en user_sessions
      await supabase
        .from('user_sessions')
        .upsert({
          phone: normalizedPhone,
          user_latitude: latitude,
          user_longitude: longitude,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' });
      
      console.log(`✅ Location saved for ${normalizedPhone}: (${latitude}, ${longitude})`);
      
      // Actualizar contexto del bot para marcar que hay decisión pendiente
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('last_bot_message')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      if (sessionData?.last_bot_message) {
        try {
          const context = JSON.parse(sessionData.last_bot_message);
          context.pending_location_decision = true;
          context.delivery_address = realAddress; // Usar dirección geocodificada real
          
          await supabase
            .from('user_sessions')
            .update({
              last_bot_message: JSON.stringify(context)
            })
            .eq('phone', normalizedPhone);
        } catch (e) {
          console.error('Error updating context with location decision:', e);
        }
      }
      
      // Responder al usuario preguntando si quiere guardar o usar temporal
      const chatId = data.key?.remoteJid?.includes('@lid')
        ? data.key.remoteJid
        : `${normalizedPhone}@s.whatsapp.net`;
      
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
      
      const addressText = realAddress;
      const confirmMessage = `📍 Recibí tu ubicación: *${addressText}*

¿Querés usarla solo para este pedido o guardarla para la próxima?

Escribí:
• *TEMP* — usar solo para este pedido (se eliminará automáticamente ⏰)
• *GUARDAR Casa* — guardarla con el nombre 'Casa' para usarla en el futuro 🏠

_Tip: Podés guardar varias direcciones con nombres como "Casa", "Trabajo", "Oficina", etc._`;
      
      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey!,
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "SupabaseFunction/1.0"
        },
        body: JSON.stringify({
          number: chatId,
          text: confirmMessage,
        }),
      });
      
      return new Response(JSON.stringify({ status: 'location_saved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const vendorData = await getVendorData(normalizedPhone);
    const session = await getOrCreateSession(normalizedPhone);

    // --- Si el usuario envía comprobante (imagen o PDF) ---
    if ((imageUrl || documentUrl) && !vendorData) {
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
        console.log('Processing payment receipt (image/document) for:', normalizedPhone);

        try {
          const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
          const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
          const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
          
          let fileBlob: Blob;
          let extension = 'jpg';
          let contentType = 'image/jpeg';
          
          // Si es un documento (PDF), usar Evolution API para desencriptarlo
          if (documentUrl) {
            console.log('📄 Processing document via Evolution API');
            
            const base64Response = await fetch(
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

            if (!base64Response.ok) {
              throw new Error('No se pudo obtener el documento de WhatsApp');
            }

            const base64Result = await base64Response.json();
            console.log('📦 Document base64 received, length:', base64Result.base64?.length);

            if (!base64Result?.base64) {
              throw new Error('No se recibió el documento en formato base64');
            }

            // Convertir base64 a Blob
            const binaryString = atob(base64Result.base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            fileBlob = new Blob([bytes]);
            
            // Determinar tipo y extensión
            if (documentMimeType?.includes('pdf')) {
              extension = 'pdf';
              contentType = 'application/pdf';
            } else if (documentFileName) {
              extension = documentFileName.split('.').pop() || 'pdf';
              contentType = documentMimeType || 'application/octet-stream';
            }
          } else if (imageUrl) {
            // Para imágenes, usar fetch directo (ya funcionan)
            console.log('📸 Processing image directly');
            const fileResponse = await fetch(imageUrl);
            fileBlob = await fileResponse.blob();
            extension = 'jpg';
            contentType = 'image/jpeg';
          } else {
            throw new Error('No file URL provided');
          }
          
          const fileName = `${normalizedPhone}-${Date.now()}.${extension}`;
          const filePath = `receipts/${fileName}`;

          console.log('📤 Uploading to storage:', { fileName, filePath, contentType });

          const { error: uploadError } = await supabase
            .storage
            .from('payment-receipts')
            .upload(filePath, fileBlob, {
              contentType: contentType,
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

        // Limpiar contexto parcialmente para evitar confusión
        try {
          const { data: userSession } = await supabase
            .from('user_sessions')
            .select('last_bot_message')
            .eq('phone', normalizedPhone)
            .maybeSingle();

          if (userSession?.last_bot_message) {
            const context = JSON.parse(userSession.last_bot_message);
            if (context.conversation_history && context.conversation_history.length > 0) {
              const lastUserMessage = context.conversation_history[context.conversation_history.length - 1];
              if (lastUserMessage?.role === 'user') {
                // Eliminar el último mensaje del usuario que falló
                context.conversation_history.pop();
                console.log('🧹 Cleaned last user message from context after audio error');
                
                await supabase.from('user_sessions').upsert({
                  phone: normalizedPhone,
                  last_bot_message: JSON.stringify(context)
                }, { onConflict: 'phone' });
              }
            }
          }
        } catch (contextError) {
          console.error('Error cleaning context:', contextError);
        }

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
            text: 'Disculpá, tuve un problema procesando tu audio. ¿Podés intentar de nuevo o escribir tu mensaje? 😊'
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

    if (!messageText && !imageUrl && !documentUrl) {
      console.log('Missing message content');
      return new Response(JSON.stringify({ status: 'invalid_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Processing message from:', normalizedPhone, 'Message:', messageText);

    // =============================================
    // SISTEMA DE DEBOUNCE - Agrupar mensajes rápidos
    // =============================================
    const debounceResult = await processWithDebounce(
      supabase,
      normalizedPhone,
      messageText,
      imageUrl,
      documentUrl,
      rawJid
    );
    
    // Para LID, usar el remoteJid original; sino usar el número normalizado
    const chatIdForDebounce = data.key?.remoteJid?.includes('@lid')
      ? data.key.remoteJid
      : `${normalizedPhone}@s.whatsapp.net`;
    
    const evolutionApiUrlDebounce = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKeyDebounce = Deno.env.get('EVOLUTION_API_KEY');
    const instanceNameDebounce = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    if (debounceResult.action === 'spam') {
      // Responder con mensaje anti-spam
      await fetch(`${evolutionApiUrlDebounce}/message/sendText/${instanceNameDebounce}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKeyDebounce!,
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "SupabaseFunction/1.0"
        },
        body: JSON.stringify({
          number: chatIdForDebounce,
          text: debounceResult.spamMessage
        }),
      });
      
      return new Response(JSON.stringify({ status: 'spam_detected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    if (debounceResult.action === 'buffered' || debounceResult.action === 'delegated') {
      // Mensaje guardado en buffer, otro proceso se encargará
      console.log(`📦 Message ${debounceResult.action} for ${normalizedPhone}`);
      return new Response(JSON.stringify({ status: debounceResult.action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // debounceResult.action === 'process' → Continuar con el procesamiento
    const finalMessageText = debounceResult.combinedText || messageText || '';
    const finalImageUrl = debounceResult.lastImageUrl || imageUrl;
    console.log(`🔄 Processing ${debounceResult.messageCount} combined message(s) for ${normalizedPhone}`);

    // 🎫 Verificar si hay un ticket de soporte abierto RECIENTE (últimas 48 horas)
    let openTicket = await supabase
      .from('support_tickets')
      .select('id, subject, status, created_at')
      .eq('customer_phone', normalizedPhone)
      .in('status', ['open', 'in_progress'])
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Últimas 48 horas
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(r => r.data);

    // 🚨 Si el ticket es de EMERGENCIA y el modo emergencia ya está desactivado, cerrarlo automáticamente
    if (openTicket && openTicket.subject?.includes('[EMERGENCIA]')) {
      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('emergency_mode, bot_enabled')
        .eq('id', 'global')
        .single();
      
      if (platformSettings && !platformSettings.emergency_mode && platformSettings.bot_enabled) {
        console.log('🔄 Closing emergency ticket because bot is back online:', openTicket.id);
        
        // Cerrar el ticket de emergencia automáticamente
        await supabase
          .from('support_tickets')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString()
          })
          .eq('id', openTicket.id);
        
        // Notificar al usuario que el servicio fue restaurado
        const chatId = data.key?.remoteJid?.includes('@lid')
          ? data.key.remoteJid
          : `${normalizedPhone}@s.whatsapp.net`;
        
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
        const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
        
        await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey!,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "SupabaseFunction/1.0"
          },
          body: JSON.stringify({
            number: chatId,
            text: '✅ ¡El servicio ha sido restaurado! Ya puedo ayudarte nuevamente. ¿En qué te puedo asistir?',
          }),
        });
        
        // Limpiar el ticket para continuar con el procesamiento normal
        openTicket = null;
      }
    }

    if (openTicket) {
      console.log('🎫 User has open support ticket:', openTicket.id);
      
      // Guardar el mensaje del usuario en support_messages
      await supabase
        .from('support_messages')
        .insert({
          ticket_id: openTicket.id,
          sender_type: 'customer',
          message: finalMessageText
        });
      
      console.log('📝 Message saved to support ticket, bot will not respond');
      
      // Liberar lock antes de salir
      await releaseLock(supabase, normalizedPhone);
      
      // NO procesamos con el bot si hay un ticket abierto
      return new Response(JSON.stringify({ status: 'support_mode', ticket_id: openTicket.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 💬 Verificar si el usuario está en modo chat directo con vendedor
    const { data: vendorSession } = await supabase
      .from('user_sessions')
      .select('in_vendor_chat, assigned_vendor_phone')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    // 🤖 Comandos del cliente para reactivar el bot
    const clientBotCommands = ['menu', 'bot', 'ayuda', 'salir', 'inicio', 'volver'];
    const isReactivateCommand = clientBotCommands.includes(finalMessageText.toLowerCase().trim());
    
    if (vendorSession?.in_vendor_chat && isReactivateCommand) {
      console.log('🔄 Client requested to reactivate bot with command:', finalMessageText);
      
      // Desactivar chat directo
      await supabase.from('user_sessions').update({
        in_vendor_chat: false,
        assigned_vendor_phone: null,
        updated_at: new Date().toISOString()
      }).eq('phone', normalizedPhone);
      
      // Continuar con el procesamiento normal del bot (no return aquí)
      console.log('✅ Bot reactivated for customer:', normalizedPhone);
    } else if (vendorSession?.in_vendor_chat) {
      console.log('💬 User is in vendor chat mode');

      // Buscar pedido activo del cliente para guardar mensaje en messages (tabla de pedidos)
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('id, vendor_id')
        .eq('customer_phone', normalizedPhone)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeOrder) {
        console.log('📝 Saving customer message to order messages:', activeOrder.id);
        
        // Guardar el mensaje del cliente en la tabla messages del pedido
        await supabase
          .from('messages')
          .insert({
            order_id: activeOrder.id,
            sender: 'customer',
            content: finalMessageText,
            is_read: false
          });

        console.log('✅ Message saved to order chat, bot will not respond');
        console.log('💡 Tip: Customer can write "menu" or "bot" to reactivate the bot');

        // Liberar lock antes de salir
        await releaseLock(supabase, normalizedPhone);

        // NO procesamos con el bot si está en chat directo
        return new Response(JSON.stringify({ status: 'vendor_chat_mode', order_id: activeOrder.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // Fallback: buscar vendor_chats activo (sistema anterior)
      const { data: activeChat } = await supabase
        .from('vendor_chats')
        .select('id, vendor_id')
        .eq('customer_phone', normalizedPhone)
        .eq('is_active', true)
        .maybeSingle();

      if (activeChat) {
        console.log('📝 Saving message to vendor chat (legacy):', activeChat.id);
        
        // Guardar el mensaje del cliente en chat_messages
        await supabase
          .from('chat_messages')
          .insert({
            chat_id: activeChat.id,
            sender_type: 'customer',
            message: finalMessageText
          });

        console.log('✅ Message saved to vendor chat, bot will not respond');

        // Liberar lock antes de salir
        await releaseLock(supabase, normalizedPhone);

        return new Response(JSON.stringify({ status: 'vendor_chat_mode', chat_id: activeChat.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } else {
        console.log('⚠️ User marked as in_vendor_chat but no active order/chat found, resetting...');
        // Si no hay chat activo, desactivar el modo
        await supabase
          .from('user_sessions')
          .update({
            in_vendor_chat: false,
            assigned_vendor_phone: null
          })
          .eq('phone', normalizedPhone);
      }
    }

    // Procesar mensaje con el bot de IA (usando texto combinado del buffer)
    let responseMessage = await processWithVendorBot(normalizedPhone, finalMessageText, finalImageUrl || undefined);

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

    // 🔓 Liberar lock después de procesar
    await releaseLock(supabase, normalizedPhone);

    return new Response(JSON.stringify({ status: 'success', messagesProcessed: debounceResult.messageCount }), {
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
