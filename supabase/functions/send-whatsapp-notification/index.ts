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
    
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    
    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials:', {
        hasAccountSid: !!accountSid,
        hasAuthToken: !!authToken,
        hasFromNumber: !!fromNumber
      });
      throw new Error('Twilio credentials not configured');
    }
    
    console.log('Using Twilio WhatsApp number:', fromNumber);
    
    // Format phone number - keep as provided (expecting E.164), just clean and ensure prefix
    let formattedPhone = phoneNumber.toString().trim();

    // Remove whatsapp: prefix if present
    if (formattedPhone.startsWith('whatsapp:')) {
      formattedPhone = formattedPhone.slice('whatsapp:'.length);
    }

    // Remove spaces
    formattedPhone = formattedPhone.replace(/\s+/g, '');

    // Ensure it starts with + and looks like E.164
    if (!formattedPhone.startsWith('+')) {
      console.error('Invalid phone format (missing +):', formattedPhone);
      throw new Error('El teléfono del cliente debe estar en formato internacional (+[código país][número]).');
    }

    // Format the From number correctly
    let formattedFromNumber = fromNumber;
    if (!formattedFromNumber.startsWith('whatsapp:')) {
      formattedFromNumber = 'whatsapp:' + formattedFromNumber;
    }

    const toParam = `whatsapp:${formattedPhone}`;
    console.log('Sending from:', formattedFromNumber, 'to:', toParam);
    
    // Send WhatsApp message via Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: formattedFromNumber,
          To: toParam,
          Body: message,
        }),
      }
    );

    const twilioResponse = await response.json();
    
    if (!response.ok) {
      console.error('Twilio API error:', {
        status: response.status,
        statusText: response.statusText,
        error: twilioResponse,
      });
      throw new Error(twilioResponse.message || twilioResponse.error_message || 'No se pudo enviar por WhatsApp');
    }
    
    console.log('WhatsApp message sent successfully:', twilioResponse.sid);

    return new Response(
      JSON.stringify({ success: true, data: twilioResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-whatsapp-notification:', error.message);
    console.error('Full error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});