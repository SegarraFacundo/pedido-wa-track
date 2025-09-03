import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // For Twilio webhooks, we need to handle form-encoded data
    // Twilio doesn't send authorization headers, so we use service role key
    const contentType = req.headers.get('content-type') || '';
    let formData;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      formData = new URLSearchParams(text);
    } else {
      formData = await req.formData();
    }
    const from = formData.get('From');
    const body = formData.get('Body');
    const profileName = formData.get('ProfileName');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process incoming WhatsApp message
    const messageData = {
      from: from?.toString().replace('whatsapp:', ''),
      body: body?.toString(),
      profileName: profileName?.toString(),
      timestamp: new Date().toISOString()
    };

    // For now, we'll skip storing the message in the database until we have an order_id
    // Messages table requires an order_id, so we'll handle message storage after order creation

    // Process with AI agent
    const aiResponse = await processWithAI(messageData, supabase);
    
    // Reply synchronously via TwiML to ensure delivery reliability
    // (Removed REST API send to avoid duplicate/no-delivery issues)
    console.log('AI response to send via TwiML:', aiResponse);

    // Return empty 200 OK response for Twilio webhook
    // Twilio expects either empty response or TwiML, not JSON
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><![CDATA[${aiResponse.message}]]></Message></Response>`;
    return new Response(twiml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

async function processWithAI(messageData: any, supabase: any) {
  try {
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIKey) {
      console.error('OpenAI API key not configured');
      return {
        intent: 'ERROR',
        message: 'Lo siento, el servicio no está disponible en este momento. Por favor, intenta más tarde.',
        entities: {}
      };
    }
    
    // Analyze message intent
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using a valid model
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de delivery inteligente. Tu trabajo es:
              1. Identificar la intención del usuario (nuevo pedido, consulta de estado, cancelación, etc)
              2. Extraer información relevante (productos, dirección, etc)
              3. Gestionar el flujo de pedidos
              4. Responder de manera amigable y eficiente
              
              Tipos de intenciones:
              - NEW_ORDER: Cliente quiere hacer un pedido
              - CHECK_STATUS: Cliente consulta estado de pedido
              - CANCEL_ORDER: Cliente quiere cancelar
              - VENDOR_INQUIRY: Pregunta sobre vendedores disponibles
              - GENERAL_HELP: Ayuda general
              
              IMPORTANTE: Responde SOLO con un objeto JSON válido, sin texto adicional:
              {
                "intent": "tipo_de_intencion",
                "entities": {},
                "message": "respuesta al usuario",
                "action": "acción a tomar"
              }`
          },
          {
            role: 'user',
            content: messageData.body || 'Hola'
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    
    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      console.error('Unexpected OpenAI response structure:', aiData);
      throw new Error('Invalid OpenAI response structure');
    }
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiData.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiData.choices[0].message.content);
      // Return a default response if parsing fails
      aiResponse = {
        intent: 'GENERAL_HELP',
        entities: {},
        message: 'Hola! Soy tu asistente de delivery. ¿En qué puedo ayudarte hoy?',
        action: 'none'
      };
    }

    // Execute action based on intent
    switch(aiResponse.intent) {
      case 'NEW_ORDER':
        await createOrder(messageData, aiResponse.entities, supabase);
        break;
      case 'CHECK_STATUS':
        const status = await checkOrderStatus(messageData.from, supabase);
        aiResponse.message += `\n\nEstado actual: ${status}`;
        break;
      case 'CANCEL_ORDER':
        await cancelOrder(messageData.from, supabase);
        break;
    }

    return aiResponse;
  } catch (error) {
    console.error('Error in processWithAI:', error);
    return {
      intent: 'ERROR',
      message: 'Lo siento, hubo un problema procesando tu mensaje. Por favor, intenta de nuevo.',
      entities: {}
    };
  }
}

async function sendTwilioMessage(to: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER'); // whatsapp:+14155238886
  
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
        To: `whatsapp:${to}`,
        Body: message,
      }),
    }
  );

  return await response.json();
}

async function createOrder(messageData: any, entities: any, supabase: any) {
  // First, get a default vendor (or use the provided vendor_id)
  let vendorId = entities.vendor_id;
  
  if (!vendorId) {
    // Get the first active vendor as default
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    vendorId = vendor?.id;
  }
  
  // Create new order based on extracted entities
  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_name: messageData.profileName || 'Cliente WhatsApp',
      customer_phone: messageData.from,
      address: entities.address || 'Por confirmar',
      items: entities.products || [],
      total: entities.total || 0,
      status: 'pending',
      estimated_delivery: new Date(Date.now() + 45 * 60000).toISOString(),
      vendor_id: vendorId
    })
    .select()
    .single();
  
  if (data) {
    // Now store the message in the messages table with the order_id
    await supabase
      .from('messages')
      .insert({
        order_id: data.id,
        sender: 'customer',
        content: messageData.body
      });
  }
    
  return data;
}

async function checkOrderStatus(phone: string, supabase: any) {
  const { data, error } = await supabase
    .from('orders')
    .select('status, estimated_delivery')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (data) {
    return `${data.status} - Entrega estimada: ${new Date(data.estimated_delivery).toLocaleString()}`;
  }
  return 'No se encontraron pedidos activos';
}

async function cancelOrder(phone: string, supabase: any) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('customer_phone', phone)
    .eq('status', 'pending')
    .select()
    .single();
    
  return data;
}