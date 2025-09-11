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
    const contentType = req.headers.get('content-type') || '';
    let formData;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      formData = new URLSearchParams(text);
    } else {
      formData = await req.formData();
    }
    
    const from = formData.get('From');
    let body = formData.get('Body');
    const profileName = formData.get('ProfileName');
    const mediaUrl = formData.get('MediaUrl0'); // Voice message URL if present
    const mediaContentType = formData.get('MediaContentType0');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle voice messages
    if (mediaUrl && mediaContentType?.includes('audio')) {
      console.log('Processing voice message:', mediaUrl);
      
      try {
        // Download the audio file from Twilio (requires basic auth)
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const headers: HeadersInit = accountSid && authToken
          ? { 'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`) }
          : {};
        const audioResponse = await fetch(mediaUrl.toString(), { headers });
        if (!audioResponse.ok) {
          console.error('Failed to download audio from Twilio:', audioResponse.status);
          throw new Error('Failed to download audio');
        }
        
        const audioBuffer = await audioResponse.arrayBuffer();
        
        // Prepare form data for OpenAI Whisper
        const openAIFormData = new FormData();
        const blob = new Blob([audioBuffer], { type: mediaContentType });
        openAIFormData.append('file', blob, 'audio.ogg');
        openAIFormData.append('model', 'whisper-1');
        openAIFormData.append('language', 'es'); // Spanish language
        
        // Send to OpenAI Whisper API
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          },
          body: openAIFormData,
        });
        
        if (!whisperResponse.ok) {
          const error = await whisperResponse.text();
          console.error('Whisper API error:', error);
          throw new Error('Failed to transcribe audio');
        }
        
        const transcription = await whisperResponse.json();
        body = transcription.text;
        
        console.log('Voice transcription:', body);
      } catch (error) {
        console.error('Error processing voice message:', error);
        const errorResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><![CDATA[😕 No pude procesar tu mensaje de voz.

Por favor intenta enviar un mensaje de texto o graba un audio más claro.]]></Message></Response>`;
        return new Response(errorResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml; charset=utf-8' },
          status: 200
        });
      }
    }

    const messageData = {
      from: from?.toString().replace('whatsapp:', ''),
      body: body?.toString(),
      profileName: profileName?.toString(),
      timestamp: new Date().toISOString(),
      isVoiceMessage: !!mediaUrl
    };

    // Process message (text or transcribed voice)
    const response = await processMessage(messageData, supabase);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><![CDATA[${response}]]></Message></Response>`;
    
    return new Response(twiml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><![CDATA[😕 Ocurrió un error procesando tu mensaje.

Intenta nuevamente o escribe "menu" para ver opciones.]]></Message></Response>`;
    return new Response(fallback, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml; charset=utf-8' },
      status: 200
    });
  }
});

async function processMessage(messageData: any, supabase: any): Promise<string> {
  const lowerMessage = messageData.body?.toLowerCase().trim() || '';
  const phone = messageData.from;
  
  // Add voice message indicator if it was transcribed
  const voicePrefix = messageData.isVoiceMessage ? '🎤 *Audio transcrito:*\n' : '';
  
  // Get or create chat session
  
  // Get or create chat session
  const { data: session } = await supabase
    .from('chat_sessions')
    .upsert({
      phone: phone,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' })
    .select()
    .maybeSingle();

  // Check if user is in active chat with vendor
  const { data: activeChat } = await supabase
    .from('vendor_chats')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (activeChat) {
    // Handle vendor chat
    if (lowerMessage === 'terminar chat') {
      await supabase
        .from('vendor_chats')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeChat.id);
      
      return '✅ Chat terminado. Gracias por contactarnos!';
    }
    
    // Forward message to vendor
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender_type: 'customer',
        message: messageData.body
      });
    
    return '📩 Mensaje enviado al vendedor. Te responderán pronto.';
  }

  // Check for quick product selection (just a number)
  if (/^\d+$/.test(lowerMessage) && session?.pending_products) {
    const productIndex = parseInt(lowerMessage) - 1;
    if (productIndex >= 0 && productIndex < session.pending_products.length) {
      return await handleQuickProductSelection(productIndex, phone, session, supabase);
    }
  }

  // Check for quick product selection (just a number)
  if (/^\d+$/.test(lowerMessage) && session?.pending_products) {
    const productIndex = parseInt(lowerMessage) - 1;
    if (productIndex >= 0 && productIndex < session.pending_products.length) {
      return await handleQuickProductSelection(productIndex, phone, session, supabase);
    }
  }

  // Check if user has selected product and is providing quantity or address
  if (session?.selected_product) {
    return await handleQuickOrderFlow(messageData.body, phone, session, supabase);
  }

  // Check for vendor selection
  if (lowerMessage.startsWith('seleccionar ')) {
    const selection = lowerMessage.replace('seleccionar ', '').trim();
    return await selectVendor(selection, phone, supabase);
  }

  // Command routing - Check for numeric options first
  if (lowerMessage === '1' || lowerMessage.includes('locales abiertos') || lowerMessage.includes('ver locales')) {
    return await showOpenVendors(supabase);
  }
  
  if (lowerMessage === '2' || lowerMessage.includes('productos disponibles') || lowerMessage.includes('ver productos')) {
    // Only show products if vendor is selected
    if (!session?.vendor_preference) {
      return '⚠️ Primero debes seleccionar un local.\n\nEscribe "1" para ver locales abiertos.';
    }
    return await showProductsWithPrices(messageData.body, supabase, session);
  }
  
  if (lowerMessage === '3' || lowerMessage.includes('pedir un producto') || lowerMessage.includes('ordenar')) {
    // Only allow ordering if vendor is selected
    if (!session?.vendor_preference) {
      return '⚠️ Primero debes seleccionar un local.\n\nEscribe "1" para ver locales abiertos.';
    }
    return await startOrder(messageData.body, phone, supabase, session);
  }

  if (lowerMessage === '4' || lowerMessage.includes('ofertas del día') || lowerMessage.includes('ver ofertas')) {
    return await getActiveOffers(supabase, session);
  }
  
  if (lowerMessage === '5' || lowerMessage.includes('estado de mi pedido') || lowerMessage === 'estado') {
    return await checkOrderStatus(phone, supabase, session);
  }
  
  if (lowerMessage === '6' || lowerMessage.includes('hablar con vendedor')) {
    return await startVendorChat(phone, supabase, session);
  }
  
  if (lowerMessage === '7' || lowerMessage.includes('calificar servicio') || lowerMessage.startsWith('calificar')) {
    // Only allow rating if vendor is selected
    if (!session?.vendor_preference) {
      return '⚠️ Primero debes seleccionar un local para calificar.\n\nEscribe "1" para ver locales abiertos.';
    }
    return await handleReview(messageData.body, phone, supabase, session);
  }

  if (lowerMessage === 'mi local' || lowerMessage.includes('local seleccionado') || lowerMessage === 'local') {
    return await showSelectedVendor(phone, session, supabase);
  }

  if (lowerMessage.includes('cambiar local') || lowerMessage.includes('resetear local') || lowerMessage.includes('quitar local')) {
    return await clearSelectedVendor(phone, supabase);
  }

  if (lowerMessage === 'menu') {
  return await getContextualMenu(phone, session, supabase, messageData.isVoiceMessage);
  }
  
  // Additional specific commands
  if (lowerMessage.includes('pagar') || lowerMessage.includes('pago')) {
    return await handlePayment(messageData.body, phone, supabase);
  }
  
  if (lowerMessage.includes('cancelar pedido')) {
    return await cancelOrder(phone, supabase);
  }
  
  if (lowerMessage.includes('cambiar estado')) {
    return await changeOrderStatus(messageData.body, phone, supabase);
  }
  
  return await getContextualMenu(phone, session, supabase);
}

async function getContextualMenu(phone: string, session: any, supabase: any, isVoiceMessage: boolean = false): Promise<string> {
  // Add voice message confirmation if applicable
  let voiceConfirmation = '';
  if (isVoiceMessage) {
    voiceConfirmation = '🎤 *Tu mensaje de voz fue procesado exitosamente*\n\n';
  }
  
  // Check if user has recent orders (within 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, status')
    .eq('customer_phone', phone)
    .or(`status.in.(pending,confirmed,preparing,ready,delivering),and(status.eq.delivered,created_at.gte.${twentyFourHoursAgo})`)
    .order('created_at', { ascending: false })
    .limit(1);
  
  const hasRecentOrder = recentOrders && recentOrders.length > 0;
  const hasVendorSelected = session?.vendor_preference !== null;
  
  let menu = voiceConfirmation;
  menu += `👋 *¡Bienvenido a DeliveryBot!*\n\n`;
  menu += `📱 *MENÚ PRINCIPAL:*\n\n`;
  menu += `1️⃣ Ver *locales abiertos*\n`;
  
  // Only show products and order options if vendor is selected
  if (hasVendorSelected) {
    menu += `2️⃣ Ver *productos* disponibles\n`;
    menu += `3️⃣ *Pedir* un producto\n`;
  }
  
  menu += `4️⃣ Ver *ofertas* del día\n`;
  
  // Only show order status if user has recent orders
  if (hasRecentOrder) {
    menu += `5️⃣ *Estado* de mi pedido\n`;
  }
  
  menu += `6️⃣ *Hablar con vendedor*\n`;
  
  // Only show rating option if vendor is selected
  if (hasVendorSelected) {
    menu += `7️⃣ *Calificar* servicio\n`;
  }
  
  menu += `\n💬 Escribe cualquier opción para comenzar!`;
  menu += `\n🎤 También puedes enviar mensajes de voz`;
  
  if (!hasVendorSelected) {
    menu += `\n\n💡 *Tip:* Selecciona primero un local (opción 1) para ver más opciones.`;
  }
  
  return menu;
}

function nowInTimeZone(timeZone: string): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const day = (parts.find(p => p.type === 'weekday')?.value || 'sunday').toLowerCase();
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';

  return { day, time: `${hour}:${minute}` };
}

async function showOpenVendors(supabase: any): Promise<string> {
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true);
  
  // Time in Argentina
  const { day: currentDay, time: currentTime } = nowInTimeZone('America/Argentina/Buenos_Aires');
  
  const openVendors = vendors?.filter((v: any) => {
    const isInDays = v.days_open?.includes(currentDay) ?? true;
    const isInHours = currentTime >= v.opening_time?.slice(0, 5) && 
                      currentTime <= v.closing_time?.slice(0, 5);
    return isInDays && isInHours;
  }) || [];
  
  if (openVendors.length === 0) {
    return '😕 No hay locales abiertos en este momento.\n\nIntenta más tarde o escribe "menu" para ver otras opciones.';
  }
  
  let message = '🏪 *LOCALES ABIERTOS AHORA:*\n\n';
  
  openVendors.forEach((vendor: any, index: number) => {
    message += `${index + 1}. *${vendor.name}*\n`;
    message += `   📍 ${vendor.address}\n`;
    message += `   ⭐ ${vendor.average_rating || 0} (${vendor.total_reviews || 0} reseñas)\n`;
    message += `   ⏰ Hasta las ${vendor.closing_time?.slice(0, 5)}\n\n`;
  });
  
  message += '📝 Escribe "seleccionar [número]" para elegir un local.';
  
  return message;
}

async function handleQuickProductSelection(productIndex: number, phone: string, session: any, supabase: any): Promise<string> {
  const product = session.pending_products[productIndex];
  
  // Save selected product in session
  await supabase
    .from('chat_sessions')
    .update({
      selected_product: product,
      selected_quantity: 1,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  let response = `✅ *Producto seleccionado:*\n`;
  response += `📦 ${product.name} - S/${product.price}\n`;
  response += `📍 ${product.vendor_name}\n\n`;
  response += `📝 *Para continuar con el pedido, escribe:*\n\n`;
  response += `• La cantidad (número entre 1-10)\n`;
  response += `• O directamente tu dirección completa\n\n`;
  response += `💡 *Ejemplos:*\n`;
  response += `"2" (para 2 unidades)\n`;
  response += `"Av. Larco 1582" (1 unidad a esa dirección)\n`;
  response += `"3 Av. España 1234" (3 unidades a esa dirección)`;
  
  return response;
}


async function handleQuickOrderFlow(message: string, phone: string, session: any, supabase: any): Promise<string> {
  const product = session.selected_product;
  const parts = message.trim().split(' ');
  
  // Check if message is just a number (quantity)
  if (/^\d+$/.test(message.trim())) {
    const quantity = parseInt(message.trim());
    if (quantity < 1 || quantity > 10) {
      return '❌ La cantidad debe ser entre 1 y 10 unidades.';
    }
    
    // Update quantity in session
    await supabase
      .from('chat_sessions')
      .update({
        selected_quantity: quantity,
        updated_at: new Date().toISOString()
      })
      .eq('phone', phone);
    
    return `✅ Cantidad: ${quantity} unidades\n\n` +
           `📝 Ahora escribe tu dirección completa para finalizar el pedido.\n` +
           `Ejemplo: Av. Larco 1582, Miraflores`;
  }
  
  // Check if it's an address (with or without quantity)
  let quantity = session.selected_quantity || 1;
  let address = message.trim();
  
  // Check if starts with number and space (quantity + address)
  const firstPart = parts[0];
  if (/^\d+$/.test(firstPart) && parts.length > 1) {
    quantity = parseInt(firstPart);
    address = parts.slice(1).join(' ');
    
    if (quantity < 1 || quantity > 10) {
      return '❌ La cantidad debe ser entre 1 y 10 unidades.';
    }
  }
  
  if (address.length < 5) {
    return '❌ Por favor ingresa una dirección válida más completa.';
  }
  
  // Create the order
  const totalAmount = product.price * quantity;
  
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_name: session.profileName || 'Cliente',
      customer_phone: phone,
      vendor_id: product.vendor_id,
      items: [{
        id: product.id,
        name: product.name,
        quantity: quantity,
        price: product.price
      }],
      total: totalAmount,
      address: address,
      status: 'pending',
      payment_status: 'pending',
      payment_amount: totalAmount
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating order:', error);
    return '❌ Error al crear el pedido. Intenta nuevamente.';
  }
  
  // Clear selection from session
  await supabase
    .from('chat_sessions')
    .update({
      selected_product: null,
      selected_quantity: 1,
      pending_products: [],
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  // Notify vendor
  await notifyVendor(product.vendor_id, order.id, 
    `Nuevo pedido: ${quantity}x ${product.name}`, supabase);
  
  // Get payment methods
  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true);
  
  let response = `✅ *PEDIDO CREADO #${order.id.slice(0, 8)}*\n\n`;
  response += `📦 ${quantity}x ${product.name}\n`;
  response += `💰 Total: *S/${totalAmount}*\n`;
  response += `📍 Dirección: ${address}\n\n`;
  
  if (paymentMethods && paymentMethods.length > 0) {
    response += `💳 *MÉTODOS DE PAGO:*\n`;
    paymentMethods.forEach((method: any) => {
      response += `• ${method.name}\n`;
    });
    response += `\n📝 Para pagar, escribe:\n"pagar [método] [detalles]"\n\n`;
    response += `Ejemplo: pagar yape 991234567`;
  }
  
  response += `\n📱 Tu pedido está confirmado y en preparación.`;
  response += `\n\nEscribe "estado" para ver el progreso.`;
  
  return response;
}

async function showSelectedVendor(phone: string, session: any, supabase: any): Promise<string> {
  if (!session?.vendor_preference) {
    return '❌ No tienes un local seleccionado.\n\nEscribe "1" para ver locales abiertos.';
  }
  
  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', session.vendor_preference)
    .maybeSingle();
  
  if (!vendor) {
    return '❌ El local seleccionado ya no está disponible.\n\nEscribe "1" para elegir otro.';
  }
  
  let response = `📍 *LOCAL SELECCIONADO:*\n\n`;
  response += `🏪 *${vendor.name}*\n`;
  response += `📍 ${vendor.address}\n`;
  response += `⭐ ${vendor.average_rating || 0} (${vendor.total_reviews || 0} reseñas)\n`;
  response += `📞 ${vendor.phone}\n`;
  response += `⏰ ${vendor.opening_time || 'N/A'} - ${vendor.closing_time || 'N/A'}\n\n`;
  response += `💡 *Opciones disponibles:*\n`;
  response += `2️⃣ Ver productos\n`;
  response += `3️⃣ Hacer pedido\n`;
  response += `4️⃣ Ver ofertas\n`;
  response += `7️⃣ Calificar\n\n`;
  response += `Para cambiar de local, escribe "cambiar local"`;
  
  return response;
}

async function clearSelectedVendor(phone: string, supabase: any): Promise<string> {
  await supabase
    .from('chat_sessions')
    .update({
      vendor_preference: null,
      pending_products: [],
      selected_product: null,
      selected_quantity: 1,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  return `✅ Local deseleccionado.\n\nEscribe "1" para ver locales abiertos y elegir uno nuevo.`;
}

async function selectVendor(selection: string, phone: string, supabase: any): Promise<string> {
  const vendorNumber = parseInt(selection);
  
  if (isNaN(vendorNumber)) {
    return '❌ Por favor, escribe un número válido.\n\nEjemplo: "seleccionar 1"';
  }
  
  // Get current open vendors
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true);
  
  // Time in Argentina
  const { day: currentDay, time: currentTime } = nowInTimeZone('America/Argentina/Buenos_Aires');
  
  const openVendors = vendors?.filter((v: any) => {
    const isInDays = v.days_open?.includes(currentDay) ?? true;
    const isInHours = currentTime >= v.opening_time?.slice(0, 5) && 
                      currentTime <= v.closing_time?.slice(0, 5);
    return isInDays && isInHours;
  }) || [];
  
  if (vendorNumber < 1 || vendorNumber > openVendors.length) {
    return `❌ Número inválido. Por favor, selecciona un número entre 1 y ${openVendors.length}.`;
  }
  
  const selectedVendor = openVendors[vendorNumber - 1];
  
  // Update session with selected vendor
  await supabase
    .from('chat_sessions')
    .update({ 
      vendor_preference: selectedVendor.id,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  return `✅ Has seleccionado *${selectedVendor.name}*\n\n` +
         `Ahora puedes:\n` +
         `2️⃣ Ver productos disponibles\n` +
         `3️⃣ Pedir un producto\n` +
         `7️⃣ Calificar este local\n\n` +
         `Escribe cualquier opción para continuar.`;
}

async function showProductsWithPrices(message: string, supabase: any, session: any): Promise<string> {
  const parts = message.toLowerCase().split(' ');
  const isJustNumber = message.trim() === '2' || message.toLowerCase().startsWith('productos');
  const searchTerm = parts[0] === 'productos' && parts.length > 1 ? parts.slice(1).join(' ') : null;

  // If a vendor is selected, show ONLY that vendor's products
  if (session?.vendor_preference) {
    const vendorId = session.vendor_preference;

    // Fetch vendor info
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, name, average_rating, opening_time, closing_time, days_open, address')
      .eq('id', vendorId)
      .maybeSingle();

    if (!vendor) {
      return '❌ No se encontró el local seleccionado. Escribe "cambiar local" para elegir otro.';
    }

    // Fetch products for selected vendor
    let query = supabase
      .from('products')
      .select('id, name, description, price, category')
      .eq('vendor_id', vendorId)
      .eq('is_available', true);

    if (searchTerm) {
      // We'll filter client-side for simplicity since we selected vendor already
      const { data: prods } = await query;
      const filtered = (prods || []).filter((p: any) =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.category || '').toLowerCase().includes(searchTerm)
      );
      return buildProductsReplyForSingleVendor(vendor, filtered, session, supabase);
    }

    const { data: products } = await query;
    return buildProductsReplyForSingleVendor(vendor, products || [], session, supabase);
  }

  // Otherwise, show products grouped by open vendors now (Argentina time)
  const { data: products } = await supabase
    .from('products')
    .select('*, vendors!inner(id, name, average_rating, is_active, opening_time, closing_time, days_open)')
    .eq('is_available', true)
    .eq('vendors.is_active', true);
  
  if (!products || products.length === 0) {
    return '😕 No encontramos productos disponibles.\n\nEscribe "1" para ver locales abiertos.';
  }

  // Filter by search term if provided
  let filteredProducts = products;
  if (searchTerm) {
    filteredProducts = products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm) ||
      p.vendors.name.toLowerCase().includes(searchTerm)
    );
    if (filteredProducts.length === 0) {
      return `😕 No encontramos productos para "${searchTerm}".\n\nEscribe "2" para ver todos los productos disponibles.`;
    }
  }

  // Argentina time
  const { day: currentDay, time: currentTime } = nowInTimeZone('America/Argentina/Buenos_Aires');

  // Group by vendor and check if open
  const productsByVendor: any = {};
  const vendorIds = new Set<string>();
  
  filteredProducts.forEach((p: any) => {
    const vendor = p.vendors;
    const isInDays = vendor.days_open?.includes(currentDay) ?? true;
    const isInHours = currentTime >= vendor.opening_time?.slice(0, 5) && 
                      currentTime <= vendor.closing_time?.slice(0, 5);
    const isOpen = isInDays && isInHours;
    
    if (isOpen) {
      if (!productsByVendor[vendor.name]) {
        productsByVendor[vendor.name] = {
          vendor_id: vendor.id,
          rating: vendor.average_rating,
          products: []
        };
        vendorIds.add(vendor.id);
      }
      productsByVendor[vendor.name].products.push({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category
      });
    }
  });
  
  if (Object.keys(productsByVendor).length === 0) {
    return '😕 No hay locales abiertos con productos disponibles en este momento.\n\nIntenta más tarde o escribe "menu" para ver otras opciones.';
  }
  
  // Get active offers for these vendors
  const { data: offers } = await supabase
    .from('vendor_offers')
    .select('*')
    .in('vendor_id', Array.from(vendorIds))
    .eq('is_active', true)
    .gte('valid_until', new Date().toISOString());
  
  // Group offers by vendor
  const offersByVendor: any = {};
  offers?.forEach((offer: any) => {
    if (!offersByVendor[offer.vendor_id]) {
      offersByVendor[offer.vendor_id] = [];
    }
    offersByVendor[offer.vendor_id].push(offer);
  });
  
  let reply = '🛒 *PRODUCTOS DISPONIBLES:*\n\n';
  let productNumber = 1;
  const productList: any[] = [];
  
  Object.entries(productsByVendor).forEach(([vendorName, data]: any) => {
    reply += `📍 *${vendorName}* ⭐${data.rating?.toFixed(1) || 'N/A'}\n`;
    
    // Show offers for this vendor if any
    const vendorOffers = offersByVendor[data.vendor_id];
    if (vendorOffers && vendorOffers.length > 0) {
      reply += `\n🎉 *OFERTAS ACTIVAS:*\n`;
      vendorOffers.forEach((offer: any) => {
        reply += `   🏷️ ${offer.title}\n`;
        if (offer.description) reply += `      ${offer.description}\n`;
        if (offer.discount_percentage) reply += `      *${offer.discount_percentage}% OFF*\n`;
        if (offer.original_price && offer.offer_price) reply += `      ~S/${offer.original_price}~ *S/${offer.offer_price}*\n`;
      });
      reply += '\n';
    }
    
    reply += `*Productos:*\n`;
    data.products.forEach((p: any) => {
      reply += `${productNumber}. ${p.name} - *S/${p.price}*\n`;
      if (p.description) reply += `   ${p.description}\n`;
      productList.push({
        ...p,
        vendor_id: data.vendor_id,
        vendor_name: vendorName,
        vendor_rating: data.rating,
        product_number: productNumber
      });
      productNumber++;
    });
    reply += '\n';
  });
  
  reply += '📝 Para pedir, escribe:\n"pedir [número] [cantidad] [dirección]"\nEjemplo: pedir 1 2 Av. Corrientes 123';
  
  // Save products in session for easy ordering
  await supabase
    .from('chat_sessions')
    .update({
      pending_products: productList,
      updated_at: new Date().toISOString()
    })
    .eq('phone', session.phone);
  
  return reply;
}

function buildProductsReplyForSingleVendor(vendor: any, products: any[], session: any, supabase: any) {
  let reply = `🛒 *PRODUCTOS DE ${vendor.name}:*\n\n`;
  if (!products || products.length === 0) {
    return reply + '😕 Este local no tiene productos disponibles ahora.';
  }

  let productNumber = 1;
  const productList: any[] = [];
  products.forEach((p: any) => {
    reply += `${productNumber}. ${p.name} - *S/${p.price}*\n`;
    if (p.description) reply += `   ${p.description}\n`;
    productList.push({
      ...p,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_rating: vendor.average_rating,
      product_number: productNumber
    });
    productNumber++;
  });

  reply += '\n📝 Para pedir, escribe:\n"pedir [número] [cantidad] [dirección]"';

  // Save products in session
  supabase
    .from('chat_sessions')
    .update({ pending_products: productList, updated_at: new Date().toISOString() })
    .eq('phone', session.phone);

  return reply;
}

async function startOrder(message: string, phone: string, supabase: any, session: any): Promise<string> {
  // Check if user has viewed products first
  if (!session?.pending_products || session.pending_products.length === 0) {
    return '❌ *Primero debes ver los productos disponibles.*\n\n' +
           '📱 Escribe "2" para ver todos los productos\n' +
           'O escribe "productos [búsqueda]" para buscar algo específico\n\n' +
           'Ejemplo: "productos pizza"';
  }
  
  // Parse order: "pedir [número] [cantidad] [dirección]"
  const parts = message.split(' ');
  
  // If user just writes "pedir" or "3", show instructions
  if (parts.length < 2 || (parts.length === 1 && (parts[0] === '3' || parts[0].toLowerCase() === 'pedir'))) {
    let response = '📝 *CÓMO HACER UN PEDIDO:*\n\n';
    response += 'Primero revisa los productos disponibles (ya lo hiciste ✅)\n\n';
    response += '📦 *Productos que viste:*\n';
    
    // Show summary of products they can order
    session.pending_products.forEach((product: any, index: number) => {
      response += `${index + 1}. ${product.name} - S/${product.price}\n`;
      response += `   📍 ${product.vendor_name}\n`;
    });
    
    response += '\n📝 *Para ordenar escribe:*\n';
    response += '"pedir [número] [cantidad] [dirección]"\n\n';
    response += '✅ *Ejemplos:*\n';
    response += '• pedir 1 2 Av. Larco 123\n';
    response += '• pedir 3 1 Jr. Unión 456, Barranco\n';
    
    return response;
  }
  
  if (parts.length < 4) {
    return '❌ *Formato incorrecto.*\n\n' +
           '📝 Usa: "pedir [número] [cantidad] [dirección]"\n' +
           'Ejemplo: pedir 1 2 Av. Larco 123\n\n' +
           'Escribe solo "3" o "pedir" para ver instrucciones detalladas.';
  }
  
  const productIndex = parseInt(parts[1]) - 1;
  const quantity = parseInt(parts[2]);
  const address = parts.slice(3).join(' ');
  
  // Validate inputs
  if (isNaN(productIndex) || isNaN(quantity)) {
    return '❌ El número de producto y cantidad deben ser números.\n\n' +
           'Ejemplo correcto: pedir 1 2 Av. Larco 123';
  }
  
  if (productIndex < 0 || productIndex >= session.pending_products.length) {
    return `❌ Producto no válido. Debes elegir un número entre 1 y ${session.pending_products.length}.\n\n` +
           'Escribe "2" para ver los productos disponibles nuevamente.';
  }
  
  if (quantity <= 0 || quantity > 10) {
    return '❌ La cantidad debe ser entre 1 y 10 unidades.';
  }
  
  if (address.length < 5) {
    return '❌ Por favor ingresa una dirección válida más completa.';
  }
  
  const selectedProduct = session.pending_products[productIndex];
  const totalAmount = selectedProduct.price * quantity;
  
  // Create order
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_name: session.profileName || 'Cliente',
      customer_phone: phone,
      vendor_id: selectedProduct.vendor_id,
      items: [{
        id: selectedProduct.id,
        name: selectedProduct.name,
        quantity: quantity,
        price: selectedProduct.price
      }],
      total: totalAmount,
      address: address,
      status: 'pending',
      payment_status: 'pending',
      payment_amount: totalAmount
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating order:', error);
    return '❌ Error al crear el pedido. Intenta nuevamente.';
  }
  
  // Clear pending products after successful order
  await supabase
    .from('chat_sessions')
    .update({
      pending_products: [],
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  // Notify vendor
  await notifyVendor(selectedProduct.vendor_id, order.id, 
    `Nuevo pedido: ${quantity}x ${selectedProduct.name}`, supabase);
  
  // Get payment methods
  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true);
  
  let response = `✅ *PEDIDO CREADO #${order.id.slice(0, 8)}*\n\n`;
  response += `📦 ${quantity}x ${selectedProduct.name}\n`;
  response += `💰 Total: *S/${totalAmount}*\n`;
  response += `📍 Dirección: ${address}\n\n`;
  response += `💳 *SELECCIONA FORMA DE PAGO:*\n\n`;
  
  paymentMethods?.forEach((method: any, index: number) => {
    response += `${index + 1}. ${method.name}\n`;
  });
  
  response += '\nEscribe "pagar [número] [referencia]"\n';
  response += 'Ejemplo: pagar 1 (para efectivo)\n';
  response += 'Ejemplo: pagar 2 REF123456 (para transferencia)';
  
  return response;
}

async function handlePayment(message: string, phone: string, supabase: any): Promise<string> {
  // Get last pending order
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', phone)
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!order) {
    return '❌ No tienes pedidos pendientes de pago.';
  }
  
  // Parse payment: "pagar [método] [referencia opcional]"
  const parts = message.split(' ');
  const methodIndex = parseInt(parts[1]) - 1;
  const reference = parts.slice(2).join(' ') || null;
  
  // Get payment methods
  const { data: methods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true);
  
  if (!methods || methodIndex < 0 || methodIndex >= methods.length) {
    return '❌ Método de pago no válido.';
  }
  
  const selectedMethod = methods[methodIndex];
  
  // Record payment
  const { error: paymentError } = await supabase
    .from('order_payments')
    .insert({
      order_id: order.id,
      payment_method_id: selectedMethod.id,
      payment_method_name: selectedMethod.name,
      amount: order.total,
      status: selectedMethod.name === 'Efectivo' ? 'pending' : 'processing',
      transaction_reference: reference,
      payment_date: new Date().toISOString()
    });
  
  if (paymentError) {
    return '❌ Error al registrar el pago. Intenta nuevamente.';
  }
  
  // Update order
  await supabase
    .from('orders')
    .update({
      payment_method: selectedMethod.name,
      payment_status: selectedMethod.name === 'Efectivo' ? 'pending' : 'processing',
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id);
  
  // Record status change
  await supabase
    .from('order_status_history')
    .insert({
      order_id: order.id,
      status: 'confirmed',
      changed_by: 'customer',
      reason: `Pago con ${selectedMethod.name}`
    });
  
  let response = `✅ *PAGO REGISTRADO*\n\n`;
  response += `📦 Pedido: #${order.id.slice(0, 8)}\n`;
  response += `💳 Método: ${selectedMethod.name}\n`;
  
  if (reference) {
    response += `📝 Referencia: ${reference}\n`;
  }
  
  if (selectedMethod.name === 'Efectivo') {
    response += '\n💵 Prepara el efectivo exacto para la entrega.';
  } else {
    response += '\n⏳ Verificando pago...';
  }
  
  response += '\n\n📱 Tu pedido está confirmado y en preparación.';
  response += '\n\nEscribe "estado" para ver el progreso.';
  
  return response;
}

async function checkOrderStatus(phone: string, supabase: any): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('*, vendors(name, phone)')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!orders || orders.length === 0) {
    return '😕 No tienes pedidos recientes.';
  }
  
  const order = orders[0];
  const statusEmoji: any = {
    'pending': '⏳',
    'confirmed': '✅',
    'preparing': '👨‍🍳',
    'ready': '📦',
    'delivering': '🚚',
    'delivered': '✅',
    'cancelled': '❌'
  };
  
  const statusText: any = {
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'preparing': 'En preparación',
    'ready': 'Listo para entrega',
    'delivering': 'En camino',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado'
  };
  
  let response = `📋 *ESTADO DE TU PEDIDO*\n\n`;
  response += `🆔 Pedido: #${order.id.slice(0, 8)}\n`;
  response += `${statusEmoji[order.status]} Estado: *${statusText[order.status]}*\n`;
  response += `📍 Local: ${order.vendors.name}\n`;
  response += `📞 Teléfono: ${order.vendors.phone}\n`;
  response += `💰 Total: S/${order.total}\n`;
  response += `💳 Pago: ${order.payment_method || 'Pendiente'} - ${order.payment_status}\n\n`;
  
  if (order.delivery_person_name) {
    response += `🚴 Repartidor: ${order.delivery_person_name}\n`;
    response += `📱 Contacto: ${order.delivery_person_phone}\n\n`;
  }
  
  // Get status history
  const { data: history } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (history && history.length > 0) {
    response += `📜 *HISTORIAL:*\n`;
    history.forEach((h: any) => {
      const time = new Date(h.created_at).toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      response += `• ${time} - ${statusText[h.status]}\n`;
    });
  }
  
  if (order.status === 'pending' || order.status === 'confirmed') {
    response += '\n❌ Para cancelar: "cancelar pedido"';
  }
  
  return response;
}

async function cancelOrder(phone: string, supabase: any): Promise<string> {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', phone)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!order) {
    return '❌ No tienes pedidos que se puedan cancelar.';
  }
  
  // Use the change_order_status function
  const { data: result } = await supabase
    .rpc('change_order_status', {
      p_order_id: order.id,
      p_new_status: 'cancelled',
      p_changed_by: 'customer',
      p_reason: 'Cancelado por el cliente'
    });
  
  if (!result) {
    return '❌ No se pudo cancelar el pedido.';
  }
  
  return `✅ *PEDIDO CANCELADO*\n\n` +
         `🆔 Pedido #${order.id.slice(0, 8)} ha sido cancelado.\n\n` +
         `Gracias por avisarnos.`;
}

async function changeOrderStatus(message: string, phone: string, supabase: any): Promise<string> {
  // This would typically be used by vendors, but customers can update certain statuses
  // Format: "cambiar estado [delivered/cancelled] [razón]"
  const parts = message.split(' ');
  
  if (parts.length < 3) {
    return '❌ Formato: "cambiar estado [delivered/cancelled] [razón]"';
  }
  
  const newStatus = parts[2];
  const reason = parts.slice(3).join(' ');
  
  if (!['delivered', 'cancelled'].includes(newStatus)) {
    return '❌ Solo puedes marcar como "delivered" o "cancelled"';
  }
  
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', phone)
    .not('status', 'in', '(delivered,cancelled)')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!order) {
    return '❌ No tienes pedidos activos.';
  }
  
  const { data: result } = await supabase
    .rpc('change_order_status', {
      p_order_id: order.id,
      p_new_status: newStatus,
      p_changed_by: 'customer',
      p_reason: reason
    });
  
  if (!result) {
    return '❌ No se pudo actualizar el estado.';
  }
  
  return `✅ Estado actualizado a: ${newStatus}\n\n` +
         `Razón: ${reason}`;
}

async function getActiveOffers(supabase: any, session?: any): Promise<string> {
  let query = supabase
    .from('vendor_offers')
    .select('*, vendors(name)')
    .eq('is_active', true)
    .gte('valid_until', new Date().toISOString())
    .limit(10);

  if (session?.vendor_preference) {
    query = query.eq('vendor_id', session.vendor_preference);
  }
  
  const { data: offers } = await query;
  
  if (!offers || offers.length === 0) {
    return '😕 No hay ofertas activas en este momento.';
  }
  
  let message = '🎉 *OFERTAS DEL DÍA:*\n\n';
  
  offers.forEach((offer: any, index: number) => {
    message += `${index + 1}. *${offer.title}*\n`;
    message += `   📍 ${offer.vendors.name}\n`;
    if (offer.description) message += `   ${offer.description}\n`;
    if (offer.discount_percentage) message += `   🏷️ *${offer.discount_percentage}% OFF*\n`;
    if (offer.original_price && offer.offer_price) message += `   💰 ~S/${offer.original_price}~ *S/${offer.offer_price}*\n`;
    message += '\n';
  });
  
  return message;
}

async function startVendorChat(phone: string, supabase: any, session?: any): Promise<string> {
  let vendorId: string | null = session?.vendor_preference || null;

  if (!vendorId) {
    // Fallback: last order vendor
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('vendor_id, vendors(name)')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastOrder) {
      return '😕 Primero selecciona un local u realiza un pedido para chatear.\nEscribe "1" para ver locales abiertos.';
    }
    vendorId = lastOrder.vendor_id;
  }

  // Create chat session
  const { data: chat, error } = await supabase
    .from('vendor_chats')
    .insert({ vendor_id: vendorId, customer_phone: phone, is_active: true })
    .select()
    .single();
  
  if (error) {
    return '❌ No se pudo iniciar el chat.';
  }
  
  // Send initial message
  await supabase
    .from('chat_messages')
    .insert({ chat_id: chat.id, sender_type: 'bot', message: `Cliente ${phone} ha iniciado un chat` });

  const { data: v } = await supabase.from('vendors').select('name').eq('id', vendorId).maybeSingle();
  return `✅ *Chat iniciado con ${v?.name || 'el vendedor'}*\n\nUn vendedor te atenderá en breve.\n\nPara terminar el chat, escribe "terminar chat".`;
}

async function handleReview(message: string, phone: string, supabase: any, session?: any): Promise<string> {
  const parts = message.split(' ');
  const rating = parseInt(parts[1]);
  
  if (!rating || rating < 1 || rating > 5) {
    return '⭐ Para calificar:\n' +
           '"calificar [1-5] [comentario]"\n\n' +
           'Ejemplo: calificar 5 Excelente servicio!';
  }
  
  const comment = parts.slice(2).join(' ');
  
  let vendorId: string | null = session?.vendor_preference || null;
  
  if (!vendorId) {
    // Fallback: last delivered order
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('vendor_id')
      .eq('customer_phone', phone)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastOrder) {
      return '😕 No tienes pedidos entregados para calificar. O selecciona un local con "1" y luego "calificar [1-5]"';
    }
    vendorId = lastOrder.vendor_id;
  }
  
  const { error } = await supabase
    .from('vendor_reviews')
    .insert({ vendor_id: vendorId, customer_phone: phone, rating: rating, comment: comment || null });
  
  if (error) {
    return '❌ No se pudo guardar tu calificación.';
  }
  
  const stars = '⭐'.repeat(rating);
  return `✅ *¡Gracias por tu calificación!*\n\n${stars}\n${comment ? `"${comment}"` : ''}`;
}

async function notifyVendor(vendorId: string, orderId: string, message: string, supabase: any) {
  try {
    await supabase
      .from('vendor_notifications')
      .insert({
        vendor_id: vendorId,
        order_id: orderId,
        message: message,
        status: 'pending'
      });
      
    // También podrías enviar un WhatsApp al vendedor aquí
    const { data: vendor } = await supabase
      .from('vendors')
      .select('whatsapp_number')
      .eq('id', vendorId)
      .maybeSingle();
      
    if (vendor?.whatsapp_number) {
      await sendTwilioMessage(vendor.whatsapp_number, 
        `🔔 Nuevo pedido #${orderId.slice(0, 8)}\n${message}`);
    }
  } catch (error) {
    console.error('Error notifying vendor:', error);
  }
}

async function sendTwilioMessage(to: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  
  if (!accountSid || !authToken || !from) {
    console.error('Twilio credentials not configured');
    return;
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${to}`,
      Body: message
    })
  });
  
  if (!response.ok) {
    console.error('Failed to send Twilio message:', await response.text());
  }
}