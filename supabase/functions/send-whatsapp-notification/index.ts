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
      console.error('Missing Twilio credentials');
      throw new Error('Twilio credentials not configured');
    }
    
    // Format phone number - ensure it doesn't already have 'whatsapp:' prefix
    let formattedPhone = phoneNumber;
    if (!phoneNumber.startsWith('whatsapp:')) {
      // Remove any '+' from the beginning
      formattedPhone = phoneNumber.replace(/^\+/, '');
      // Add country code if not present (assuming Argentina +54)
      if (!formattedPhone.startsWith('54')) {
        formattedPhone = '54' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;
    }
    
    console.log('Sending WhatsApp message to:', formattedPhone);
    
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
          From: fromNumber!,
          To: `whatsapp:${formattedPhone}`,
          Body: message,
        }),
      }
    );

    const twilioResponse = await response.json();
    
    if (!response.ok) {
      console.error('Twilio API error:', twilioResponse);
      throw new Error(twilioResponse.message || 'Failed to send WhatsApp message');
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
    console.error('Error in send-whatsapp-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});