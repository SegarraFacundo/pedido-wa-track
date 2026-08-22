import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, mimeType } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio transcription request');

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);

    const mt = (mimeType || '').toLowerCase();
    // Determine file extension based on mime type
    const extension = mt.includes('ogg') || mt.includes('opus') ? 'ogg' :
                     mt.includes('webm') ? 'webm' :
                     mt.includes('mp4') || mt.includes('m4a') ? 'mp4' :
                     mt.includes('mpeg') || mt.includes('mp3') ? 'mp3' :
                     mt.includes('wav') ? 'wav' : 'webm';

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const useGateway = !!lovableApiKey;

    // WhatsApp envía OGG/Opus, que los modelos de STT de OpenAI rechazan.
    // En ese caso transcribimos con Gemini vía chat completions (acepta ogg).
    const transcribeWithGemini = async (): Promise<string> => {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Lovable-API-Key': lovableApiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.6-flash',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribí este audio en español rioplatense. Devolvé SOLO el texto transcripto, sin comentarios ni comillas. Si no se entiende nada, devolvé una cadena vacía.' },
              { type: 'input_audio', input_audio: { data: audio, format: extension === 'mp4' ? 'm4a' : extension } },
            ],
          }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini transcription error: ${resp.status} ${errText}`);
      }
      const data = await resp.json();
      return (data.choices?.[0]?.message?.content ?? '').toString().trim();
    };

    const isOgg = extension === 'ogg';

    if (useGateway && isOgg) {
      console.log('🎙️ STT provider: Lovable AI Gateway (Gemini audio, ogg)');
      const text = await transcribeWithGemini();
      console.log('Transcription successful:', text);
      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare form data
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: mimeType || 'audio/webm' });
    formData.append('file', blob, `audio.${extension}`);
    formData.append('model', useGateway ? 'openai/gpt-4o-mini-transcribe' : 'whisper-1');
    formData.append('language', 'es'); // Spanish language

    console.log(`🎙️ STT provider: ${useGateway ? 'Lovable AI Gateway' : 'OpenAI'}`);

    const endpoint = useGateway
      ? 'https://ai.gateway.lovable.dev/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions';

    const headers: Record<string, string> = useGateway
      ? { 'Lovable-API-Key': lovableApiKey! }
      : { 'Authorization': `Bearer ${openaiApiKey}` };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Transcription API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes alcanzado, probá de nuevo en unos segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA agotados. Recargá créditos para seguir usando audios.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Formato rechazado por el STT: intentamos con Gemini como fallback
      if (useGateway && response.status === 400) {
        console.log('↩️ Fallback a Gemini para transcribir el audio');
        const text = await transcribeWithGemini();
        console.log('Transcription successful (fallback):', text);
        return new Response(
          JSON.stringify({ text }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Transcription API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Transcription successful:', result.text);

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );



  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
