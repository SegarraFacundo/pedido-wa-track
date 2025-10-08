import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para normalizar números de teléfono argentinos
function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Si ya tiene formato correcto 549XXXXXXXXXX (13 dígitos)
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    return '+' + cleaned;
  }
  
  // Si tiene 54 sin el 9: 54XXXXXXXXXX (12 dígitos) -> agregar el 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    return '+549' + cleaned.substring(2);
  }
  
  // Si empieza con 9: 9XXXXXXXXXX (11 dígitos) -> agregar 54
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    return '+54' + cleaned;
  }
  
  // Si es número local sin código de país: XXXXXXXXXX (10 dígitos) -> agregar 549
  if (!cleaned.startsWith('54') && cleaned.length === 10) {
    return '+549' + cleaned;
  }
  
  // Si ya tiene +, retornar tal cual
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Si nada coincide, agregar + y retornar
  return '+' + cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, message, phoneNumber } = await req.json();
    
    console.log('Received WhatsApp notification request:', { orderId, phoneNumber, message });
    
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      console.error('Missing Evolution API credentials:', {
        hasUrl: !!evolutionApiUrl,
        hasApiKey: !!evolutionApiKey,
        hasInstance: !!instanceName
      });
      throw new Error('Evolution API credentials not configured');
    }
    
    console.log('Using Evolution API instance:', instanceName);
    
    // Normalizar el número de teléfono
    const formattedPhone = normalizeArgentinePhone(phoneNumber ?? '');
    console.log('Phone normalization:', phoneNumber, '->', formattedPhone);
    console.log('Sending to:', formattedPhone);
    
    // Send WhatsApp message via Evolution API
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      }
    );

    const evolutionResponse = await response.json();
    
    if (!response.ok) {
      console.error('Evolution API error:', {
        status: response.status,
        statusText: response.statusText,
        error: evolutionResponse,
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: evolutionResponse.message || 'No se pudo enviar por WhatsApp', 
          details: evolutionResponse 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    console.log('WhatsApp message sent successfully:', evolutionResponse.key?.id);

    return new Response(
      JSON.stringify({ success: true, data: evolutionResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-whatsapp-notification:', errorMessage);
    console.error('Full error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
