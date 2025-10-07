import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    // Normalize phone number to international format
    let formattedPhone = (phoneNumber ?? '').toString().trim();
    
    // Remove any non-digits except +
    formattedPhone = formattedPhone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!formattedPhone.startsWith('+')) {
      // Default to Argentina (+54) if no country code
      if (formattedPhone.startsWith('54')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('9')) {
        formattedPhone = '+54' + formattedPhone;
      } else {
        formattedPhone = '+549' + formattedPhone;
      }
    }

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
