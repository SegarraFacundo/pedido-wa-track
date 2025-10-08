import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para normalizar números de teléfono argentinos para Evolution API
// IMPORTANTE: WhatsApp NO usa el 9 en el JID, solo el código de país + área + número
function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // CRÍTICO: Detectar y corregir números con doble 9
  // Si tiene formato 54993... (14 dígitos) o 549 seguido de otro 9 -> es un error, remover el 9 extra
  if (cleaned.match(/^54993/) && cleaned.length === 14) {
    // Remover el primer 9 después del 549: 54993412699024 -> 5493412699024
    cleaned = '549' + cleaned.substring(4);
    console.log('⚠️ Detected double 9, corrected:', phone, '->', cleaned);
  }
  
  // Si tiene formato 549XXXXXXXXXX (13 dígitos) -> REMOVER el 9 para WhatsApp
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    // WhatsApp usa 54 + área + número (sin el 9)
    const withoutNine = '54' + cleaned.substring(3);
    console.log('📱 Removing 9 for WhatsApp JID:', cleaned, '->', withoutNine);
    return withoutNine;
  }
  
  // Si tiene 54 sin el 9: 54XXXXXXXXXX (12 dígitos) -> ya está correcto para WhatsApp
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    return cleaned;
  }
  
  // Si empieza con 9: 9XXXXXXXXXX (11 dígitos) -> agregar 54 (sin el 9 extra)
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    return '54' + cleaned.substring(1);
  }
  
  // Si es número local sin código de país: XXXXXXXXXX (10 dígitos) -> agregar 54
  if (!cleaned.startsWith('54') && cleaned.length === 10) {
    return '54' + cleaned;
  }
  
  // Si ya tiene +, limpiar y reprocesar
  if (phone.startsWith('+')) {
    return normalizeArgentinePhone(cleaned);
  }
  
  // Si nada coincide, retornar tal cual
  return cleaned;
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
