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
    
    // Determine file extension based on mime type
    const extension = mimeType?.includes('webm') ? 'webm' : 
                     mimeType?.includes('mp4') ? 'mp4' : 
                     mimeType?.includes('mpeg') ? 'mp3' : 'webm';
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const useGateway = !!lovableApiKey;

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
