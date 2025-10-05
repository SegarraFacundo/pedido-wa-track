export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // COMANDOS DE ESCAPE - Siempre disponibles
  if (lowerMessage === 'menu' || lowerMessage === 'ayuda' || lowerMessage === 'inicio') {
    return await getWelcomeMessage(phone, supabase);
  }

  // VENDEDOR - Siempre disponible, la salida más importante
  if (lowerMessage.includes('vendedor') || lowerMessage.includes('hablar') || lowerMessage === '3') {
    return await startVendorChat(phone, supabase);
  }

  // Check for active vendor chat first
  const { data: activeChat } = await supabase
    .from('vendor_chats')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (activeChat) {
    if (lowerMessage === 'terminar chat' || lowerMessage === 'salir') {
      await supabase
        .from('vendor_chats')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeChat.id);
      return '✅ Chat terminado.\n\nEscribe "menu" para ver opciones o "vendedor" para iniciar otro chat.';
    }
    
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender_type: 'customer',
        message: message
      });
    
    return '📩 Mensaje enviado al vendedor.\n\n💡 Escribe "terminar chat" para salir o continúa escribiendo.';
  }

  // OFERTAS
  if (lowerMessage === '1' || lowerMessage.includes('ofertas') || lowerMessage.includes('promociones')) {
    return await getActiveOffers(supabase);
  }

  // ESTADO DEL PEDIDO
  if (lowerMessage === '5' || lowerMessage.includes('estado') || lowerMessage.includes('pedido')) {
    return await getOrderStatus(phone, supabase);
  }

  // CALIFICAR
  if (lowerMessage === '6' || lowerMessage.startsWith('calificar') || lowerMessage.startsWith('review')) {
    return await handleReview(message, phone, supabase);
  }

  // HORARIOS
  if (lowerMessage === '4' || lowerMessage.includes('horario') || lowerMessage.includes('abierto')) {
    return await getVendorHours(supabase);
  }

  // HACER PEDIDO - Captura cualquier intención
  if (lowerMessage === '2' || 
      lowerMessage.includes('pedir') || 
      lowerMessage.includes('quiero') ||
      lowerMessage.includes('ordenar') ||
      lowerMessage.includes('comprar')) {
    return await initiateOrder(message, phone, supabase);
  }

  // BÚSQUEDA INTELIGENTE - Si escribe algo que parece un producto
  if (lowerMessage.length > 3 && !lowerMessage.match(/^\d+$/)) {
    const searchResult = await smartProductSearch(message, phone, supabase);
    if (searchResult) return searchResult;
  }

  // Respuesta por defecto
  return await getWelcomeMessage(phone, supabase);
}

async function smartProductSearch(message: string, phone: string, supabase: any): Promise<string | null> {
  try {
    const searchTerm = message.toLowerCase().trim();
    
    // Buscar en productos
    const { data: products } = await supabase
      .from('products')
      .select('*, vendors!inner(id, name, is_active)')
      .eq('is_available', true)
      .eq('vendors.is_active', true)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
      .limit(5);
    
    if (!products || products.length === 0) {
      return null; // Let default handler take over
    }
    
    let response = `🔍 *Encontré ${products.length} resultado(s):*\n\n`;
    
    products.forEach((p: any, index: number) => {
      response += `${index + 1}. *${p.name}* - $${p.price}\n`;
      response += `   📍 ${p.vendors.name}\n`;
      if (p.description) response += `   ${p.description}\n`;
      response += '\n';
    });
    
    response += `💡 *Para pedir:*\n`;
    response += `• Escribe "vendedor" para hablar con alguien\n`;
    response += `• O escribe "2" para ver cómo hacer tu pedido\n`;
    response += `• O escribe "menu" para más opciones`;
    
    return response;
  } catch (e) {
    return null;
  }
}

async function initiateOrder(message: string, phone: string, supabase: any): Promise<string> {
  let response = `📦 *¡PERFECTO! Vamos a hacer tu pedido*\n\n`;
  response += `Tienes 2 opciones:\n\n`;
  response += `1️⃣ *RÁPIDO* - Habla con un vendedor:\n`;
  response += `   Escribe "vendedor" y te ayudamos personalmente\n\n`;
  response += `2️⃣ *EXPLORAR* - Mira nuestros productos:\n`;
  response += `   • Escribe "ofertas" para ver promociones\n`;
  response += `   • O busca: "pizza", "hamburguesa", etc.\n\n`;
  response += `💬 ¿Qué prefieres?`;
  
  return response;
}

async function getActiveOffers(supabase: any): Promise<string> {
  try {
    const { data: offers } = await supabase
      .from('vendor_offers')
      .select('*, vendors(name)')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .limit(5);

    if (!offers || offers.length === 0) {
      return '😕 No hay ofertas activas ahora.\n\n💡 *Opciones:*\n• Escribe "vendedor" para hablar con alguien\n• Escribe "menu" para ver más opciones';
    }

    let message = '🎉 *OFERTAS ESPECIALES* 🎉\n\n';

    offers.forEach((offer: any, index: number) => {
      message += `${index + 1}. *${offer.title}*\n`;
      message += `   📍 ${offer.vendors.name}\n`;
      message += `   ${offer.description}\n`;

      if (offer.discount_percentage) {
        message += `   🏷️ *${offer.discount_percentage}% OFF*\n`;
      }

      if (offer.original_price && offer.offer_price) {
        message += `   💰 ~$${offer.original_price}~ *$${offer.offer_price}*\n`;
      }

      message += '\n';
    });

    message += `💡 *Para pedir:*\n`;
    message += `• Escribe "vendedor" para que te ayudemos\n`;
    message += `• O busca el producto que quieras`;

    return message;
  } catch (e) {
    return fallbackMessage();
  }
}

async function startVendorChat(phone: string, supabase: any): Promise<string> {
  try {
    // Verificar si ya tiene un chat activo
    const { data: existingChat } = await supabase
      .from('vendor_chats')
      .select('*')
      .eq('customer_phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (existingChat) {
      return `💬 *Ya tienes un chat activo*\n\n` +
             `Puedes continuar escribiendo y el vendedor verá tus mensajes.\n\n` +
             `Para terminar escribe "terminar chat"`;
    }

    // Buscar vendor activo
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!vendor) {
      return '😕 No hay vendedores disponibles ahora.\n\nIntenta más tarde o escribe "menu" para otras opciones.';
    }

    // Crear chat
    const { data: chat, error } = await supabase
      .from('vendor_chats')
      .insert({
        vendor_id: vendor.id,
        customer_phone: phone,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return '❌ Error al iniciar chat.\n\nEscribe "menu" para ver otras opciones.';
    }

    // Mensaje inicial
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: chat.id,
        sender_type: 'bot',
        message: `Cliente ${phone} ha iniciado un chat`
      });

    return `✅ *Chat iniciado con ${vendor.name}*\n\n` +
           `🎯 *Ahora puedes escribir libremente*\n` +
           `Un vendedor te atenderá en breve.\n\n` +
           `Ejemplos de lo que puedes preguntar:\n` +
           `• "¿Tienen pizza de pepperoni?"\n` +
           `• "Quiero hacer un pedido"\n` +
           `• "¿Entregan a [tu zona]?"\n\n` +
           `Para terminar: "terminar chat"`;
  } catch (e) {
    return fallbackMessage();
  }
}

async function handleReview(message: string, phone: string, supabase: any): Promise<string> {
  try {
    const parts = message.split(' ');
    const rating = parseInt(parts[1]);

    if (!rating || rating < 1 || rating > 5) {
      return '⭐ *Para calificar usa:*\n' +
             '"calificar [1-5] [comentario]"\n\n' +
             'Ejemplo: calificar 5 Excelente servicio!\n\n' +
             '💡 O escribe "vendedor" si tienes dudas';
    }

    const comment = parts.slice(2).join(' ');

    const { data: lastOrder } = await supabase
      .from('orders')
      .select('vendor_id')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastOrder) {
      return '😕 No encontramos pedidos para calificar.\n\n💡 Escribe "vendedor" si crees que hay un error.';
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
      return '❌ Error al guardar.\n\nEscribe "vendedor" para reportar el problema.';
    }

    const stars = '⭐'.repeat(rating);
    return `✅ *¡Gracias por tu calificación!*\n\n` +
           `${stars}\n` +
           `${comment ? `"${comment}"` : ''}\n\n` +
           `Tu opinión nos ayuda a mejorar.\n\n` +
           `Escribe "menu" para más opciones.`;
  } catch (e) {
    return fallbackMessage();
  }
}

async function getVendorHours(supabase: any): Promise<string> {
  try {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('name, opening_time, closing_time, days_open')
      .eq('is_active', true);

    if (!vendors || vendors.length === 0) {
      return '😕 Sin información de horarios.\n\n💡 Escribe "vendedor" para consultar.';
    }

    let message = '🕐 *HORARIOS DE ATENCIÓN*\n\n';

    vendors.forEach((vendor: any) => {
      message += `📍 *${vendor.name}*\n`;
      message += `   ⏰ ${vendor.opening_time} - ${vendor.closing_time}\n`;
      message += `   📅 ${vendor.days_open?.join(', ') || 'Todos los días'}\n\n`;
    });

    message += `💡 *Opciones:*\n`;
    message += `• Escribe "vendedor" para hacer un pedido\n`;
    message += `• Escribe "ofertas" para ver promociones`;

    return message;
  } catch (e) {
    return fallbackMessage();
  }
}

async function getOrderStatus(phone: string, supabase: any): Promise<string> {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at, total')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(3);

    if (!orders || orders.length === 0) {
      return '📦 No tienes pedidos activos.\n\n💡 *Opciones:*\n• Escribe "vendedor" para hacer un pedido\n• Escribe "ofertas" para ver promociones\n• Escribe "menu" para más opciones';
    }

    let message = '📦 *TUS PEDIDOS ACTIVOS*\n\n';

    orders.forEach((order: any, index: number) => {
      const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'preparing': '👨‍🍳',
        'in_transit': '🚚',
      }[order.status] || '📋';

      const statusText = {
        'pending': 'Pendiente',
        'confirmed': 'Confirmado',
        'preparing': 'En preparación',
        'in_transit': 'En camino',
      }[order.status] || order.status;

      message += `${index + 1}. ${statusEmoji} *${statusText}*\n`;
      message += `   💰 Total: $${order.total}\n`;
      message += `   📅 ${new Date(order.created_at).toLocaleString('es-AR')}\n\n`;
    });

    message += `💡 *¿Necesitas ayuda?*\n`;
    message += `Escribe "vendedor" para hablar con alguien`;

    return message;
  } catch (e) {
    return '❌ Error al consultar pedidos.\n\nEscribe "vendedor" para ayuda.';
  }
}

async function getWelcomeMessage(phone: string, supabase: any): Promise<string> {
  try {
    // Check for active orders
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
      .limit(1);

    const hasActiveOrders = activeOrders && activeOrders.length > 0;

    // Check for completed orders
    const { data: completedOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_phone', phone)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1);

    const hasCompletedOrders = completedOrders && completedOrders.length > 0;

    let message = `👋 *¡Bienvenido!*\n\n` +
                  `Soy tu asistente virtual.\n\n` +
                  `📱 *MENÚ PRINCIPAL:*\n\n` +
                  `1️⃣ Ver *ofertas* del día\n` +
                  `2️⃣ *Hacer pedido*\n` +
                  `3️⃣ *Hablar con vendedor* 💬\n` +
                  `4️⃣ Ver *horarios*\n`;

    if (hasActiveOrders) {
      message += `5️⃣ Ver *estado* de pedido\n`;
    }

    if (hasCompletedOrders) {
      message += `6️⃣ *Calificar* servicio\n`;
    }

    message += `\n✍️ *O escribe lo que buscas*\n`;
    message += `Ejemplo: "pizza", "hamburguesa"\n\n`;
    message += `🎯 *TIP: Escribe "vendedor" en cualquier momento para ayuda personalizada*`;

    return message;
  } catch (e) {
    return `👋 *¡Bienvenido!*\n\n` +
           `📱 *MENÚ:*\n` +
           `1️⃣ Ofertas\n` +
           `2️⃣ Hacer pedido\n` +
           `3️⃣ Hablar con vendedor 💬\n` +
           `4️⃣ Horarios\n\n` +
           `🎯 Escribe "vendedor" para ayuda`;
  }
}

function fallbackMessage(): string {
  return '🤔 No entendí.\n\n💡 *Opciones:*\n• Escribe "vendedor" para hablar con alguien\n• Escribe "menu" para ver opciones';
}