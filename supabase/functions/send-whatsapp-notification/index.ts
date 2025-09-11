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
    
    // Format phone number - handle different formats
    let formattedPhone = phoneNumber.toString().trim();
    
    // Remove whatsapp: prefix if present
    if (formattedPhone.startsWith('whatsapp:')) {
      formattedPhone = formattedPhone.replace('whatsapp:', '');
    }
    
    // Remove any non-digit characters except +
    formattedPhone = formattedPhone.replace(/[^\d+]/g, '');
    
    // Remove + if present
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }
    
    // Add country code if not present (assuming Argentina +54)
    if (!formattedPhone.startsWith('54')) {
      // If it starts with 11 (Buenos Aires area code), prepend 54
      // Otherwise prepend 549 for mobile numbers
      if (formattedPhone.startsWith('11')) {
        formattedPhone = '549' + formattedPhone;
      } else {
        formattedPhone = '549' + formattedPhone;
      }
    }
    
    // Ensure it starts with +
    formattedPhone = '+' + formattedPhone;
    
    console.log('Formatted phone number:', formattedPhone);
    
    // Format the From number correctly
    let formattedFromNumber = fromNumber;
    if (!formattedFromNumber.startsWith('whatsapp:')) {
      formattedFromNumber = 'whatsapp:' + formattedFromNumber;
    }
    
    console.log('Sending from:', formattedFromNumber, 'to:', `whatsapp:${formattedPhone}`);
    
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
          To: `whatsapp:${formattedPhone}`,
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
        from: formattedFromNumber,
        to: `whatsapp:${formattedPhone}`
      });
      throw new Error(twilioResponse.message || twilioResponse.error_message || 'Failed to send WhatsApp message');
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