import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Normaliza números argentinos (formato fijo: 549XXXXXXXXX)
function normalizeArgentinePhone(phone: string): string {
  if (!phone) return '';

  // Limpieza general
  let cleaned = phone.replace(/@[\w.]+$/i, ''); // quitar @s.whatsapp.net, @c.us, etc.
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, '').replace(/[^\d]/g, '');

  console.log(`🔧 Normalizing phone "${phone}" -> "${cleaned}"`);

  // Detectar doble 9 (ej: 54993... => 5493...)
  if (/^54993/.test(cleaned) && cleaned.length === 14) {
    cleaned = '549' + cleaned.substring(4);
    console.log('⚠️ Double 9 detected, fixed ->', cleaned);
  }

  // 549XXXXXXXXXXX (correcto)
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    return cleaned;
  }

  // 54XXXXXXXXXXX (sin 9)
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    cleaned = '549' + cleaned.substring(2);
  }

  // 9XXXXXXXXXXX (sin 54)
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    cleaned = '54' + cleaned;
  }

  // Local de 10 dígitos
  if (!cleaned.startsWith('54') && cleaned.length === 10) {
    cleaned = '549' + cleaned;
  }

  // Si tiene más de 13, recortar manteniendo últimos 10 dígitos locales
  if (cleaned.length > 13) {
    cleaned = '549' + cleaned.slice(-10);
  }

  if (!cleaned.startsWith('549') || cleaned.length !== 13) {
    console.warn('⚠️ Unexpected phone format after normalization:', cleaned);
  }

  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, message, phoneNumber } = await req.json();
    console.log('📨 WhatsApp notification request:', { orderId, phoneNumber, message });

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error('Evolution API credentials not configured');
    }

    console.log('✅ Using Evolution instance:', instanceName);

    // Normalizar número y construir chatId correcto
    const normalizedPhone = normalizeArgentinePhone(phoneNumber);
    const chatId = `${normalizedPhone}@c.us`;

    console.log('📞 Normalized phone:', normalizedPhone);
    console.log('💬 chatId to send:', chatId);

    // Enviar mensaje a Evolution API
    const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        chatId, // ✅ usar chatId, no number
        text: message,
      }),
    });

    const evolutionResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Evolution API error:', {
        status: response.status,
        statusText: response.statusText,
        body: evolutionResponse,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: evolutionResponse.message || 'No se pudo enviar por WhatsApp',
          details: evolutionResponse,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('✅ WhatsApp message sent successfully:', evolutionResponse.key?.id);

    return new Response(
      JSON.stringify({ success: true, data: evolutionResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 Error in send-whatsapp-notification:', msg, error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
