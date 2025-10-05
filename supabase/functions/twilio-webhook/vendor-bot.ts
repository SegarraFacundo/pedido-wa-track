// Estados posibles del bot
type BotState = 
  | 'MAIN_MENU'
  | 'BROWSING_OFFERS'
  | 'SELECTING_VENDOR'
  | 'ORDERING'
  | 'VENDOR_CHAT'
  | 'VIEWING_HOURS'
  | 'TRACKING_ORDER'
  | 'RATING';

interface UserSession {
  phone: string;
  state: BotState;
  context?: {
    selected_vendor_id?: string;
    selected_products?: any[];
    last_interaction?: string;
  };
}

// Obtener o crear sesión
async function getSession(phone: string, supabase: any): Promise<UserSession> {
  const { data } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (data) {
    return {
      phone: data.phone,
      state: (data.previous_state as BotState) || 'MAIN_MENU',
      context: data.last_bot_message ? JSON.parse(data.last_bot_message) : {}
    };
  }

  // Crear nueva sesión
  const newSession: UserSession = {
    phone,
    state: 'MAIN_MENU',
    context: {}
  };
  
  await supabase
    .from('user_sessions')
    .upsert({
      phone,
      previous_state: 'MAIN_MENU',
      last_bot_message: JSON.stringify({}),
      updated_at: new Date().toISOString()
    });

  return newSession;
}

// Guardar sesión
async function saveSession(session: UserSession, supabase: any): Promise<void> {
  await supabase
    .from('user_sessions')
    .upsert({
      phone: session.phone,
      previous_state: session.state,
      last_bot_message: JSON.stringify(session.context || {}),
      updated_at: new Date().toISOString()
    });
}

export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // COMANDOS GLOBALES - Disponibles en cualquier momento
  
  // Ayuda - Mostrar información y enlace a web
  if (lowerMessage === 'ayuda' || lowerMessage === 'help' || lowerMessage === 'info') {
    return `ℹ️ *CENTRO DE AYUDA*\n\n` +
           `🌐 *Visita nuestra web:*\n` +
           `https://tu-sitio.lovable.app\n\n` +
           `📱 *Comandos útiles:*\n` +
           `• *menu* - Ver menú principal\n` +
           `• *vendedor* - Hablar con alguien\n` +
           `• *ofertas* - Ver promociones\n` +
           `• *volver* - Regresar\n` +
           `• *salir* - Cerrar conversación actual\n\n` +
           `💡 También puedes escribir directamente lo que buscas:\n` +
           `Ejemplo: "pizza", "hamburguesa"`;
  }

  // Menu - Volver al menú principal
  if (lowerMessage === 'menu' || lowerMessage === 'inicio' || lowerMessage === 'empezar') {
    const session = await getSession(phone, supabase);
    session.state = 'MAIN_MENU';
    session.context = {};
    await saveSession(session, supabase);
    return await getMainMenu(phone, supabase);
  }

  // Salir - Cerrar conversación actual
  if (lowerMessage === 'salir' || lowerMessage === 'cancelar') {
    const session = await getSession(phone, supabase);
    
    // Si está en vendor chat, cerrarlo
    const { data: activeChat } = await supabase
      .from('vendor_chats')
      .select('*')
      .eq('customer_phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (activeChat) {
      await supabase
        .from('vendor_chats')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeChat.id);
    }

    session.state = 'MAIN_MENU';
    session.context = {};
    await saveSession(session, supabase);
    
    return `✅ Conversación cerrada.\n\n` +
           `Escribe *menu* para ver opciones o *ayuda* para más información.`;
  }

  // Volver - Regresar al estado anterior
  if (lowerMessage === 'volver' || lowerMessage === 'atras' || lowerMessage === 'regresar') {
    const session = await getSession(phone, supabase);
    session.state = 'MAIN_MENU';
    await saveSession(session, supabase);
    return await getMainMenu(phone, supabase);
  }

  // Vendedor - Siempre disponible, escapar a chat humano
  if (lowerMessage.includes('vendedor') || lowerMessage.includes('hablar') || lowerMessage === '3') {
    return await startVendorChat(phone, supabase);
  }

  // Verificar si está en vendor chat activo
  const { data: activeChat } = await supabase
    .from('vendor_chats')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (activeChat) {
    // Guardar mensaje para el vendedor
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender_type: 'customer',
        message: message
      });
    
    return `📩 *Mensaje enviado al vendedor*\n\n` +
           `Continúa escribiendo o usa:\n` +
           `• *salir* - Terminar chat\n` +
           `• *menu* - Volver al menú`;
  }

  // Obtener sesión actual
  const session = await getSession(phone, supabase);

  // OFERTAS
  if (lowerMessage === '1' || lowerMessage.includes('ofertas') || lowerMessage.includes('promociones')) {
    session.state = 'BROWSING_OFFERS';
    await saveSession(session, supabase);
    return await getActiveOffers(phone, supabase);
  }

  // HACER PEDIDO
  if (lowerMessage === '2' || 
      lowerMessage.includes('pedir') || 
      lowerMessage.includes('quiero') ||
      lowerMessage.includes('ordenar') ||
      lowerMessage.includes('comprar')) {
    session.state = 'ORDERING';
    await saveSession(session, supabase);
    return await initiateOrder(message, phone, supabase);
  }

  // HORARIOS (solo si hace sentido)
  if (lowerMessage === '4' || lowerMessage.includes('horario') || lowerMessage.includes('abierto')) {
    session.state = 'VIEWING_HOURS';
    await saveSession(session, supabase);
    return await getVendorHours(phone, supabase);
  }

  // ESTADO DEL PEDIDO (solo si tiene pedidos activos)
  if (lowerMessage === '5' || lowerMessage.includes('estado') || lowerMessage.includes('mi pedido')) {
    session.state = 'TRACKING_ORDER';
    await saveSession(session, supabase);
    return await getOrderStatus(phone, supabase);
  }

  // CALIFICAR (solo si tiene pedidos completados)
  if (lowerMessage === '6' || lowerMessage.startsWith('calificar') || lowerMessage.startsWith('review')) {
    session.state = 'RATING';
    await saveSession(session, supabase);
    return await handleReview(message, phone, supabase);
  }

  // BÚSQUEDA INTELIGENTE - Si escribe algo que parece un producto
  if (lowerMessage.length > 3 && !lowerMessage.match(/^\d+$/)) {
    const searchResult = await smartProductSearch(message, phone, supabase);
    if (searchResult) {
      session.state = 'BROWSING_OFFERS';
      await saveSession(session, supabase);
      return searchResult;
    }
  }

  // Si escribió solo "hola" o saludo, mostrar menú
  if (lowerMessage === 'hola' || lowerMessage === 'hi' || lowerMessage === 'buenos dias' || 
      lowerMessage === 'buenas tardes' || lowerMessage === 'buenas noches') {
    return await getMainMenu(phone, supabase);
  }

  // Por defecto, si no entendió nada, mostrar menú con sugerencia
  return `🤔 No estoy seguro de entender.\n\n` +
         `💡 *Puedes:*\n` +
         `• Escribir *menu* para ver opciones\n` +
         `• Escribir *vendedor* para hablar con alguien\n` +
         `• Escribir *ayuda* para más información\n` +
         `• O buscar directamente: "pizza", "hamburguesa"`;
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
      return null;
    }
    
    let response = `🔍 *Encontré ${products.length} resultado(s) para "${searchTerm}":*\n\n`;
    
    products.forEach((p: any, index: number) => {
      response += `${index + 1}. *${p.name}* - $${p.price}\n`;
      response += `   📍 ${p.vendors.name}\n`;
      if (p.description) response += `   ${p.description}\n`;
      response += '\n';
    });
    
    response += `💬 *Para ordenar:*\n`;
    response += `• Escribe *vendedor* para asistencia personalizada\n`;
    response += `• Escribe *menu* para más opciones\n`;
    response += `• Escribe *volver* para regresar`;
    
    return response;
  } catch (e) {
    return null;
  }
}

async function initiateOrder(message: string, phone: string, supabase: any): Promise<string> {
  return `📦 *¡Perfecto! Hagamos tu pedido*\n\n` +
         `Tienes 2 formas de hacerlo:\n\n` +
         `1️⃣ *ASISTENCIA PERSONAL*\n` +
         `   Escribe *vendedor* y te ayudamos paso a paso\n\n` +
         `2️⃣ *EXPLORAR*\n` +
         `   • Escribe *ofertas* para ver promociones\n` +
         `   • O busca directamente: "pizza", "hamburguesa"\n\n` +
         `💡 *Comandos útiles:*\n` +
         `• *menu* - Volver al menú\n` +
         `• *volver* - Regresar\n` +
         `• *ayuda* - Ver más opciones`;
}

async function getMainMenu(phone: string, supabase: any): Promise<string> {
  try {
    // Verificar pedidos activos
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
      .limit(1);

    const hasActiveOrders = activeOrders && activeOrders.length > 0;

    // Verificar pedidos completados
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
                  `📱 *OPCIONES DISPONIBLES:*\n\n` +
                  `1️⃣ Ver *ofertas* del día\n` +
                  `2️⃣ *Hacer pedido* (describe lo que necesitas)\n` +
                  `3️⃣ *Hablar con vendedor* 💬\n` +
                  `4️⃣ Ver *horarios* de atención\n`;

    if (hasActiveOrders) {
      message += `5️⃣ Ver *estado* de tu pedido\n`;
    }

    if (hasCompletedOrders) {
      message += `6️⃣ *Calificar* servicio\n`;
    }

    message += `\n💡 *TIPS:*\n`;
    message += `• Escribe el número de opción (1, 2, 3...)\n`;
    message += `• O busca directamente: "pizza", "hamburguesa"\n`;
    message += `• Escribe *ayuda* para más información\n`;
    message += `• Escribe *vendedor* en cualquier momento para ayuda personalizada`;

    return message;
  } catch (e) {
    return `👋 *¡Bienvenido!*\n\n` +
           `📱 *MENÚ:*\n` +
           `1️⃣ Ofertas\n` +
           `2️⃣ Hacer pedido\n` +
           `3️⃣ Hablar con vendedor 💬\n\n` +
           `💡 Escribe *vendedor* para ayuda personalizada\n` +
           `📖 Escribe *ayuda* para más opciones`;
  }
}

async function getActiveOffers(phone: string, supabase: any): Promise<string> {
  try {
    const { data: offers } = await supabase
      .from('vendor_offers')
      .select('*, vendors(name)')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .limit(5);

    if (!offers || offers.length === 0) {
      return `😕 *No hay ofertas activas ahora*\n\n` +
             `💡 *Opciones:*\n` +
             `• Escribe *vendedor* para consultar\n` +
             `• Escribe *menu* para más opciones\n` +
             `• Busca productos: "pizza", "hamburguesa"`;
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

    message += `💬 *Para ordenar:*\n`;
    message += `• Escribe *vendedor* para asistencia\n`;
    message += `• Escribe *menu* para más opciones\n`;
    message += `• Escribe *volver* para regresar`;

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
             `Continúa escribiendo y el vendedor verá tus mensajes.\n\n` +
             `💡 *Comandos útiles:*\n` +
             `• *salir* - Terminar chat\n` +
             `• *menu* - Volver al menú\n` +
             `• *ayuda* - Ver más opciones`;
    }

    // Buscar vendor activo
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!vendor) {
      return `😕 *No hay vendedores disponibles en este momento*\n\n` +
             `💡 *Opciones:*\n` +
             `• Escribe *menu* para ver otras opciones\n` +
             `• Intenta más tarde\n` +
             `• Escribe *ayuda* para más información`;
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
      return `❌ *Error al iniciar chat*\n\n` +
             `• Escribe *menu* para ver otras opciones\n` +
             `• Intenta nuevamente en un momento`;
    }

    // Mensaje inicial
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: chat.id,
        sender_type: 'system',
        message: `Cliente ${phone} ha iniciado un chat`
      });

    return `✅ *Chat iniciado con ${vendor.name}*\n\n` +
           `🎯 *Ahora puedes escribir libremente*\n` +
           `Un vendedor te atenderá pronto.\n\n` +
           `💭 *Ejemplos de consultas:*\n` +
           `• "¿Tienen pizza de pepperoni?"\n` +
           `• "Quiero hacer un pedido de..."\n` +
           `• "¿Entregan a [tu zona]?"\n` +
           `• "¿Cuánto demora el delivery?"\n\n` +
           `💡 *Comandos útiles:*\n` +
           `• *salir* - Terminar chat\n` +
           `• *menu* - Volver al menú\n` +
           `• *ayuda* - Ver más información`;
  } catch (e) {
    return fallbackMessage();
  }
}

async function handleReview(message: string, phone: string, supabase: any): Promise<string> {
  try {
    const parts = message.split(' ');
    const rating = parseInt(parts[1]);

    if (!rating || rating < 1 || rating > 5) {
      return `⭐ *CALIFICAR SERVICIO*\n\n` +
             `📝 *Formato:*\n` +
             `calificar [1-5] [comentario opcional]\n\n` +
             `*Ejemplos:*\n` +
             `• calificar 5 Excelente servicio\n` +
             `• calificar 4\n` +
             `• calificar 3 Llegó un poco tarde\n\n` +
             `💡 *Comandos útiles:*\n` +
             `• *vendedor* - Hablar con alguien\n` +
             `• *menu* - Ver más opciones\n` +
             `• *volver* - Regresar`;
    }

    const comment = parts.slice(2).join(' ');

    const { data: lastOrder } = await supabase
      .from('orders')
      .select('vendor_id')
      .eq('customer_phone', phone)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastOrder) {
      return `😕 *No encontramos pedidos completados para calificar*\n\n` +
             `💡 *Opciones:*\n` +
             `• Escribe *vendedor* si crees que hay un error\n` +
             `• Escribe *menu* para más opciones`;
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
      return `❌ *Error al guardar calificación*\n\n` +
             `• Escribe *vendedor* para reportar el problema\n` +
             `• Escribe *menu* para más opciones`;
    }

    const stars = '⭐'.repeat(rating);
    return `✅ *¡Gracias por tu calificación!*\n\n` +
           `${stars}\n` +
           `${comment ? `"${comment}"` : ''}\n\n` +
           `Tu opinión nos ayuda a mejorar.\n\n` +
           `💡 *Siguientes pasos:*\n` +
           `• Escribe *menu* para más opciones\n` +
           `• Escribe *ofertas* para ver promociones\n` +
           `• Escribe *vendedor* para asistencia`;
  } catch (e) {
    return fallbackMessage();
  }
}

async function getVendorHours(phone: string, supabase: any): Promise<string> {
  try {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('name, opening_time, closing_time, days_open')
      .eq('is_active', true);

    if (!vendors || vendors.length === 0) {
      return `😕 *No hay información de horarios disponible*\n\n` +
             `💡 *Opciones:*\n` +
             `• Escribe *vendedor* para consultar\n` +
             `• Escribe *menu* para ver más opciones`;
    }

    let message = '🕐 *HORARIOS DE ATENCIÓN*\n\n';

    vendors.forEach((vendor: any) => {
      message += `📍 *${vendor.name}*\n`;
      message += `   ⏰ ${vendor.opening_time} - ${vendor.closing_time}\n`;
      message += `   📅 ${vendor.days_open?.join(', ') || 'Todos los días'}\n\n`;
    });

    message += `💬 *Siguientes pasos:*\n`;
    message += `• Escribe *vendedor* para hacer un pedido\n`;
    message += `• Escribe *ofertas* para ver promociones\n`;
    message += `• Escribe *menu* para más opciones\n`;
    message += `• Escribe *volver* para regresar`;

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
      return `📦 *No tienes pedidos activos*\n\n` +
             `💡 *Opciones:*\n` +
             `• Escribe *vendedor* para hacer un pedido\n` +
             `• Escribe *ofertas* para ver promociones\n` +
             `• Escribe *menu* para más opciones`;
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

    message += `💬 *¿Necesitas ayuda?*\n`;
    message += `• Escribe *vendedor* para hablar con alguien\n`;
    message += `• Escribe *menu* para más opciones\n`;
    message += `• Escribe *volver* para regresar`;

    return message;
  } catch (e) {
    return `❌ *Error al consultar pedidos*\n\n` +
           `• Escribe *vendedor* para ayuda\n` +
           `• Escribe *menu* para más opciones`;
  }
}

function fallbackMessage(): string {
  return `🤔 *No entendí tu mensaje*\n\n` +
         `💡 *Puedes intentar:*\n` +
         `• Escribir *menu* para ver todas las opciones\n` +
         `• Escribir *vendedor* para hablar con alguien\n` +
         `• Escribir *ayuda* para más información\n` +
         `• Buscar productos: "pizza", "hamburguesa", etc.`;
}