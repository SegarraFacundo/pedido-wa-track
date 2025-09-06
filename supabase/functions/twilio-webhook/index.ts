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
    const body = formData.get('Body');
    const profileName = formData.get('ProfileName');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const messageData = {
      from: from?.toString().replace('whatsapp:', ''),
      body: body?.toString(),
      profileName: profileName?.toString(),
      timestamp: new Date().toISOString()
    };

    // Process message
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
  
  // Get or create chat session
  const { data: session } = await supabase
    .from('chat_sessions')
    .upsert({
      phone: phone,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' })
    .select()
    .single();

  // Check if user is in active chat with vendor
  const { data: activeChat } = await supabase
    .from('vendor_chats')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_active', true)
    .single();

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

  // Command routing - Check for numeric options first
  if (lowerMessage === '1' || lowerMessage.includes('locales abiertos') || lowerMessage.includes('ver locales')) {
    return await showOpenVendors(supabase);
  }
  
  if (lowerMessage === '2' || lowerMessage.includes('productos disponibles') || lowerMessage.includes('ver productos')) {
    return await showProductsWithPrices(messageData.body, supabase, session);
  }
  
  if (lowerMessage === '3' || lowerMessage.includes('pedir un producto') || lowerMessage.includes('ordenar')) {
    return await startOrder(messageData.body, phone, supabase, session);
  }
  
  if (lowerMessage === '4' || lowerMessage.includes('ofertas del día') || lowerMessage.includes('ver ofertas')) {
    return await getActiveOffers(supabase);
  }
  
  if (lowerMessage === '5' || lowerMessage.includes('estado de mi pedido') || lowerMessage === 'estado') {
    return await checkOrderStatus(phone, supabase);
  }
  
  if (lowerMessage === '6' || lowerMessage.includes('hablar con vendedor')) {
    return await startVendorChat(phone, supabase);
  }
  
  if (lowerMessage === '7' || lowerMessage.includes('calificar servicio') || lowerMessage.startsWith('calificar')) {
    return await handleReview(messageData.body, phone, supabase);
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
  
  return getMainMenu();
}

function getMainMenu(): string {
  return `👋 *¡Bienvenido a DeliveryBot!*\n\n` +
         `📱 *MENÚ PRINCIPAL:*\n\n` +
         `1️⃣ Ver *locales abiertos*\n` +
         `2️⃣ Ver *productos* disponibles\n` +
         `3️⃣ *Pedir* un producto\n` +
         `4️⃣ Ver *ofertas* del día\n` +
         `5️⃣ *Estado* de mi pedido\n` +
         `6️⃣ *Hablar con vendedor*\n` +
         `7️⃣ *Calificar* servicio\n\n` +
         `💬 Escribe cualquier opción para comenzar!`;
}

async function showOpenVendors(supabase: any): Promise<string> {
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true);
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  
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
  
  message += '📝 Escribe "productos [nombre del local]" para ver su menú.';
  
  return message;
}

async function showProductsWithPrices(message: string, supabase: any, session: any): Promise<string> {
  // Default behavior: show all products if just "2" or "productos" is sent
  const parts = message.toLowerCase().split(' ');
  const isJustNumber = message.trim() === '2';
  const searchTerm = !isJustNumber && parts.length > 1 ? parts.slice(1).join(' ') : null;
  
  // Get products - if no search term, get all available products
  const { data: products } = await supabase
    .from('products')
    .select('*, vendors!inner(id, name, average_rating, is_active, opening_time, closing_time, days_open)')
    .eq('is_available', true)
    .eq('vendors.is_active', true);
  
  if (!products || products.length === 0) {
    return '😕 No encontramos productos disponibles.\n\nEscribe "1" o "locales abiertos" para ver opciones.';
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
  
  // Check which vendors are open now
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  
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
        if (offer.description) {
          reply += `      ${offer.description}\n`;
        }
        if (offer.discount_percentage) {
          reply += `      *${offer.discount_percentage}% OFF*\n`;
        }
        if (offer.original_price && offer.offer_price) {
          reply += `      ~S/${offer.original_price}~ *S/${offer.offer_price}*\n`;
        }
      });
      reply += '\n';
    }
    
    reply += `*Productos:*\n`;
    data.products.forEach((p: any) => {
      reply += `${productNumber}. ${p.name} - *S/${p.price}*\n`;
      if (p.description) {
        reply += `   ${p.description}\n`;
      }
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
  
  reply += '📝 Para pedir, escribe:\n';
  reply += '"pedir [número] [cantidad] [dirección]"\n';
  reply += 'Ejemplo: pedir 1 2 Av. Larco 123';
  
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

async function getActiveOffers(supabase: any): Promise<string> {
  const { data: offers } = await supabase
    .from('vendor_offers')
    .select('*, vendors(name)')
    .eq('is_active', true)
    .gte('valid_until', new Date().toISOString())
    .limit(10);
  
  if (!offers || offers.length === 0) {
    return '😕 No hay ofertas activas en este momento.';
  }
  
  let message = '🎉 *OFERTAS DEL DÍA:*\n\n';
  
  offers.forEach((offer: any, index: number) => {
    message += `${index + 1}. *${offer.title}*\n`;
    message += `   📍 ${offer.vendors.name}\n`;
    message += `   ${offer.description}\n`;
    
    if (offer.discount_percentage) {
      message += `   🏷️ *${offer.discount_percentage}% OFF*\n`;
    }
    
    if (offer.original_price && offer.offer_price) {
      message += `   💰 ~S/${offer.original_price}~ *S/${offer.offer_price}*\n`;
    }
    
    message += '\n';
  });
  
  return message;
}

async function startVendorChat(phone: string, supabase: any): Promise<string> {
  // Get the vendor from the last order
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('vendor_id, vendors(name)')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!lastOrder) {
    return '😕 Primero debes hacer un pedido para chatear con el vendedor.';
  }
  
  // Create chat session
  const { data: chat, error } = await supabase
    .from('vendor_chats')
    .insert({
      vendor_id: lastOrder.vendor_id,
      customer_phone: phone,
      is_active: true
    })
    .select()
    .single();
  
  if (error) {
    return '❌ No se pudo iniciar el chat.';
  }
  
  // Send initial message
  await supabase
    .from('chat_messages')
    .insert({
      chat_id: chat.id,
      sender_type: 'bot',
      message: `Cliente ${phone} ha iniciado un chat`
    });
  
  return `✅ *Chat iniciado con ${lastOrder.vendors.name}*\n\n` +
         `Un vendedor te atenderá en breve.\n\n` +
         `Para terminar el chat, escribe "terminar chat".`;
}

async function handleReview(message: string, phone: string, supabase: any): Promise<string> {
  const parts = message.split(' ');
  const rating = parseInt(parts[1]);
  
  if (!rating || rating < 1 || rating > 5) {
    return '⭐ Para calificar:\n' +
           '"calificar [1-5] [comentario]"\n\n' +
           'Ejemplo: calificar 5 Excelente servicio!';
  }
  
  const comment = parts.slice(2).join(' ');
  
  // Get last delivered order
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('vendor_id')
    .eq('customer_phone', phone)
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!lastOrder) {
    return '😕 No tienes pedidos entregados para calificar.';
  }
  
  const { error } = await supabase
    .from('vendor_reviews')
    .insert({
      vendor_id: lastOrder.vendor_id,
      customer_phone: phone,
      rating: rating,
      comment: comment || null
    });
  
  if (error) {
    return '❌ No se pudo guardar tu calificación.';
  }
  
  const stars = '⭐'.repeat(rating);
  return `✅ *¡Gracias por tu calificación!*\n\n` +
         `${stars}\n` +
         `${comment ? `"${comment}"` : ''}\n\n` +
         `Tu opinión nos ayuda a mejorar.`;
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
      .single();
      
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