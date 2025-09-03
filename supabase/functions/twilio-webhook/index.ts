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

    // Kick off AI processing but enforce fast webhook response
    const aiPromise = processWithAI(messageData, supabase);

    // 8s timeout to avoid Twilio webhook timeout (~15s)
    const timeoutPromise = new Promise<{message: string; intent: string; entities: any}>(resolve => {
      setTimeout(() => resolve({
        intent: 'PROCESSING',
        entities: {},
        message: '✅ Recibido. Estoy procesando tu mensaje y te responderé en unos segundos…'
      }), 8000);
    });

    const firstResponse = await Promise.race([aiPromise, timeoutPromise]);

    // If we timed out, continue processing and then send via REST when ready
    aiPromise.then(async (final) => {
      if (final && final.message && final !== firstResponse) {
        try {
          await sendTwilioMessage(messageData.from!, final.message);
        } catch (e) {
          console.error('Error sending async Twilio message:', e);
        }
      }
    }).catch((e) => console.error('AI processing failed after timeout:', e));

    console.log('TwiML immediate reply:', firstResponse);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><![CDATA[${firstResponse.message}]]></Message></Response>`;
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

    // Get available vendors with products
    const availableVendors = await getAvailableVendors(supabase, messageData.body);
    
    // Get or create chat session
    const { data: session } = await supabase
      .from('chat_sessions')
      .upsert({
        phone: messageData.from,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })
      .select()
      .single();

    // Build vendor menu with categories and prices
    const vendorMenu = availableVendors.map((v: any) => {
      let menu = `📍 *${v.name}* (${v.category})\n⏰ ${v.opening_time?.slice(0,5)} - ${v.closing_time?.slice(0,5)}\n`;
      
      if (v.available_products && Array.isArray(v.available_products)) {
        const productsByCategory: any = {};
        
        // Sample products with categories if not defined
        const sampleProducts = v.category === 'restaurant' ? [
          { category: '🍕 Pizzas', items: [
            { name: 'Napolitana', price: 3000 },
            { name: 'Mozzarella', price: 2800 },
            { name: 'Fugazzeta', price: 2900 }
          ]},
          { category: '🥤 Bebidas', items: [
            { name: 'Coca Cola 1.5L', price: 800 },
            { name: 'Agua mineral', price: 400 }
          ]},
          { category: '🍰 Postres', items: [
            { name: 'Flan casero', price: 600 },
            { name: 'Helado 1/4kg', price: 1200 }
          ]}
        ] : v.category === 'pharmacy' ? [
          { category: '💊 Medicamentos', items: [
            { name: 'Ibuprofeno 400mg', price: 500 },
            { name: 'Paracetamol 500mg', price: 400 }
          ]},
          { category: '🧴 Cuidado Personal', items: [
            { name: 'Shampoo', price: 1200 },
            { name: 'Jabón', price: 300 }
          ]}
        ] : [
          { category: '🛒 Productos', items: [
            { name: 'Producto 1', price: 1000 },
            { name: 'Producto 2', price: 1500 }
          ]}
        ];
        
        sampleProducts.forEach((cat: any) => {
          menu += `\n${cat.category}:\n`;
          cat.items.forEach((item: any) => {
            menu += `  • ${item.name} - $${item.price}\n`;
          });
        });
      }
      
      return menu;
    }).join('\n---\n');
    
    // Analyze message intent with session context
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de delivery inteligente. Tu trabajo es:
              1. Identificar la intención del usuario
              2. Extraer información relevante (productos, dirección)
              3. NO repetir preguntas ya respondidas
              4. Mostrar menús con precios cuando sea relevante
              
              CONTEXTO DE LA SESIÓN:
              - Productos pendientes: ${JSON.stringify(session?.pending_products || [])}
              - Dirección pendiente: ${session?.pending_address || 'No indicada'}
              
              LOCALES DISPONIBLES AHORA:
              ${vendorMenu || 'No hay locales abiertos en este momento'}
              
              REGLAS IMPORTANTES:
              - Si ya tienes productos y dirección, crea el pedido inmediatamente
              - Si falta algo, pregunta SOLO lo que falta
              - Cuando muestres productos, incluye precios
              - Sé breve y claro
              
              Tipos de intenciones:
              - NEW_ORDER: Cliente quiere hacer un pedido
              - CHECK_STATUS: Cliente consulta estado
              - VENDOR_INQUIRY: Pregunta sobre vendedores
              - GENERAL_HELP: Ayuda general
              
              Responde SOLO con JSON válido:
              {
                "intent": "tipo",
                "entities": {
                  "products": [],
                  "address": "",
                  "vendor_id": ""
                },
                "message": "respuesta",
                "action": "save_products|save_address|create_order|none"
              }`
          },
          {
            role: 'user',
            content: messageData.body || 'Hola'
          }
        ],
        temperature: 0.5,
        max_tokens: 800
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
      aiResponse = {
        intent: 'GENERAL_HELP',
        entities: {},
        message: `¡Hola! Puedo ayudarte a pedir delivery 🚚\n\n${vendorMenu ? 'Estos locales están abiertos ahora:\n\n' + vendorMenu : 'No hay locales abiertos en este momento.'}`,
        action: 'none'
      };
    }

    // Update session based on action
    if (aiResponse.action === 'save_products' && aiResponse.entities?.products) {
      await supabase.from('chat_sessions').update({
        pending_products: aiResponse.entities.products,
        updated_at: new Date().toISOString()
      }).eq('phone', messageData.from);
    } else if (aiResponse.action === 'save_address' && aiResponse.entities?.address) {
      await supabase.from('chat_sessions').update({
        pending_address: aiResponse.entities.address,
        updated_at: new Date().toISOString()
      }).eq('phone', messageData.from);
    } else if (aiResponse.action === 'create_order') {
      // Merge session data with current entities
      const finalEntities = {
        ...aiResponse.entities,
        products: aiResponse.entities.products || session?.pending_products || [],
        address: aiResponse.entities.address || session?.pending_address || ''
      };
      
      const order = await createOrder(messageData, finalEntities, supabase, aiResponse.entities?.vendor_id);
      if (order) {
        await notifyVendor(order.vendor_id, order.id, messageData.body, supabase);
        // Clear session after successful order
        await supabase.from('chat_sessions').update({
          pending_products: [],
          pending_address: null,
          vendor_preference: null,
          updated_at: new Date().toISOString()
        }).eq('phone', messageData.from);
        
        aiResponse.message = `✅ ¡Pedido #${order.id.slice(0, 8)} creado!\n\n📍 Dirección: ${finalEntities.address}\n⏰ Entrega estimada: 30-45 minutos\n\nEl local fue notificado y confirmará tu pedido pronto.`;
      }
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

async function getAvailableVendors(supabase: any, messageContent: string) {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format
  
  // Get all active vendors with their business hours
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true)
    .contains('days_open', [currentDay]);
  
  // Filter by opening hours
  const availableVendors = vendors?.filter((vendor: any) => {
    return currentTime >= vendor.opening_time && currentTime <= vendor.closing_time;
  }) || [];
  
  return availableVendors;
}

async function notifyVendor(vendorId: string, orderId: string, orderDetails: string, supabase: any) {
  try {
    // Get vendor details
    const { data: vendor } = await supabase
      .from('vendors')
      .select('name, whatsapp_number')
      .eq('id', vendorId)
      .single();
    
    if (!vendor || !vendor.whatsapp_number) {
      console.log('Vendor WhatsApp not configured');
      return;
    }
    
    // Create notification record
    await supabase
      .from('vendor_notifications')
      .insert({
        vendor_id: vendorId,
        order_id: orderId,
        message: `Nuevo pedido recibido: ${orderDetails}`,
        status: 'pending'
      });
    
    // Send WhatsApp notification to vendor
    const message = `🔔 *Nuevo Pedido*\n\n${orderDetails}\n\nPor favor, confirma el pedido en tu panel de control.`;
    
    await sendTwilioMessage(vendor.whatsapp_number, message);
    
    // Update notification status
    await supabase
      .from('vendor_notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('order_id', orderId);
    
  } catch (error) {
    console.error('Error notifying vendor:', error);
  }
}

async function connectToVendor(customerPhone: string, supabase: any) {
  // Get the customer's most recent order
  const { data: order } = await supabase
    .from('orders')
    .select('vendor_id')
    .eq('customer_phone', customerPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!order) {
    return null;
  }
  
  // Get vendor contact info
  const { data: vendor } = await supabase
    .from('vendors')
    .select('name, whatsapp_number')
    .eq('id', order.vendor_id)
    .single();
  
  return vendor;
}

async function createOrder(messageData: any, entities: any, supabase: any, suggestedVendorId?: string) {
  // Use suggested vendor or find the best match
  let vendorId = suggestedVendorId || entities.vendor_id;
  
  if (!vendorId) {
    // Get an available vendor based on current time and products
    const availableVendors = await getAvailableVendors(supabase, messageData.body);
    
    if (availableVendors.length > 0) {
      vendorId = availableVendors[0].id;
    }
  }
  
  if (!vendorId) {
    // No vendors available
    return null;
  }
  
  // Create new order based on extracted entities
  const customerName = messageData.profileName || 'Cliente WhatsApp';
  const customerPhone = messageData.from;
  const customerAddress = entities.address || 'Por confirmar';
  
  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      address: customerAddress,
      items: entities.products || [],
      total: entities.total || 0,
      status: 'pending',
      estimated_delivery: new Date(Date.now() + 45 * 60000).toISOString(),
      vendor_id: vendorId
    })
    .select()
    .single();
  
  if (data && !error) {
    // Store sensitive customer data separately in customer_contacts table
    await supabase
      .from('customer_contacts')
      .insert({
        order_id: data.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress
      });
    
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