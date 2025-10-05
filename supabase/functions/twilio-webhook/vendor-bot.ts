// Estados posibles del bot - flujo de pedido completo
type BotState = 
  | 'WELCOME'
  | 'SELECTING_VENDOR'
  | 'BROWSING_PRODUCTS'
  | 'ADDING_ITEMS'
  | 'CONFIRMING_ITEMS'
  | 'COLLECTING_ADDRESS'
  | 'COLLECTING_PAYMENT'
  | 'CONFIRMING_ORDER'
  | 'ORDER_PLACED'
  | 'VENDOR_CHAT'
  | 'TRACKING_ORDER';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface UserSession {
  phone: string;
  state: BotState;
  context?: {
    selected_vendor_id?: string;
    selected_vendor_name?: string;
    cart?: CartItem[];
    delivery_address?: string;
    payment_method?: string;
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
      state: (data.previous_state as BotState) || 'WELCOME',
      context: data.last_bot_message ? JSON.parse(data.last_bot_message) : {}
    };
  }

  // Crear nueva sesión
  const newSession: UserSession = {
    phone,
    state: 'WELCOME',
    context: { cart: [] }
  };
  
  await supabase
    .from('user_sessions')
    .upsert({
      phone,
      previous_state: 'WELCOME',
      last_bot_message: JSON.stringify({ cart: [] }),
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

  // COMANDOS GLOBALES
  if (lowerMessage === 'ayuda' || lowerMessage === 'help') {
    return `ℹ️ *CENTRO DE AYUDA*\n\n` +
           `🌐 *Visita nuestra web:*\n` +
           `https://tu-sitio.lovable.app\n\n` +
           `💬 Escribe *menu* para empezar a hacer tu pedido`;
  }

  if (lowerMessage === 'menu' || lowerMessage === 'inicio' || lowerMessage === 'empezar') {
    const session = await getSession(phone, supabase);
    session.state = 'WELCOME';
    session.context = { cart: [] };
    await saveSession(session, supabase);
    return await getWelcomeMessage(supabase);
  }

  if (lowerMessage === 'cancelar' || lowerMessage === 'salir') {
    const session = await getSession(phone, supabase);
    session.state = 'WELCOME';
    session.context = { cart: [] };
    await saveSession(session, supabase);
    return `❌ Pedido cancelado.\n\nEscribe *menu* cuando quieras hacer un nuevo pedido.`;
  }

  // Obtener sesión
  const session = await getSession(phone, supabase);

  // Verificar chat con vendedor humano
  const { data: activeChat } = await supabase
    .from('vendor_chats')
    .select('*')
    .eq('customer_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (activeChat) {
    if (lowerMessage === 'cerrar' || lowerMessage === 'terminar') {
      await supabase
        .from('vendor_chats')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeChat.id);
      return `✅ Chat cerrado.\n\nEscribe *menu* para volver a empezar.`;
    }

    await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender_type: 'customer',
        message: message
      });
    
    return `📩 Mensaje enviado. Un vendedor te responderá pronto.\n\n_Escribe *cerrar* para terminar el chat._`;
  }

  // FLUJO PRINCIPAL DEL BOT VENDEDOR
  
  // Estado: BIENVENIDA
  if (session.state === 'WELCOME' || lowerMessage === 'hola' || lowerMessage === 'hi') {
    session.state = 'SELECTING_VENDOR';
    await saveSession(session, supabase);
    return await showVendorSelection(supabase);
  }

  // Estado: SELECCIONANDO VENDEDOR/NEGOCIO
  if (session.state === 'SELECTING_VENDOR') {
    const vendorId = await findVendorFromMessage(lowerMessage, supabase);
    if (vendorId) {
      session.context = session.context || {};
      session.context.selected_vendor_id = vendorId.id;
      session.context.selected_vendor_name = vendorId.name;
      session.context.cart = [];
      session.state = 'BROWSING_PRODUCTS';
      await saveSession(session, supabase);
      return await showVendorProducts(vendorId.id, vendorId.name, supabase);
    }
    return `🤔 No encontré ese negocio.\n\nEscribe el número o nombre del negocio que quieres.`;
  }

  // Estado: NAVEGANDO PRODUCTOS
  if (session.state === 'BROWSING_PRODUCTS') {
    // Opción: hablar con vendedor humano
    if (lowerMessage.includes('vendedor') || lowerMessage.includes('ayuda')) {
      return await startVendorChatForOrder(phone, session.context?.selected_vendor_id!, supabase);
    }

    // Buscar producto
    const product = await findProductFromMessage(lowerMessage, session.context?.selected_vendor_id!, supabase);
    if (product) {
      session.state = 'ADDING_ITEMS';
      session.context = session.context || {};
      session.context.pending_product = product;
      await saveSession(session, supabase);
      return `🛒 *${product.name}* - $${product.price}\n\n` +
             `¿Cuántas unidades quieres? (ej: "2", "tres")\n\n` +
             `_Escribe *cancelar* para volver._`;
    }
    
    return `🤔 No encontré ese producto.\n\n` +
           `Escribe el nombre o número del producto que quieres agregar.\n` +
           `O escribe *vendedor* si necesitas ayuda.`;
  }

  // Estado: AGREGANDO CANTIDAD
  if (session.state === 'ADDING_ITEMS') {
    const quantity = parseQuantity(lowerMessage);
    if (quantity > 0) {
      const product = session.context?.pending_product;
      if (product) {
        session.context = session.context || {};
        session.context.cart = session.context.cart || [];
        session.context.cart.push({
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          price: product.price
        });
        delete session.context.pending_product;
        session.state = 'CONFIRMING_ITEMS';
        await saveSession(session, supabase);
        
        const cart = session.context.cart;
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        
        let cartSummary = `✅ *Agregado al carrito*\n\n`;
        cartSummary += `📦 *Tu pedido:*\n`;
        cart.forEach((item: CartItem) => {
          cartSummary += `• ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Quieres agregar algo más?\n`;
        cartSummary += `• Escribe el producto para agregar\n`;
        cartSummary += `• Escribe *confirmar* para continuar con el pedido\n`;
        cartSummary += `• Escribe *cancelar* para empezar de nuevo`;
        
        return cartSummary;
      }
    }
    return `❌ Por favor escribe una cantidad válida (ej: "2", "tres")`;
  }

  // Estado: CONFIRMANDO ITEMS
  if (session.state === 'CONFIRMING_ITEMS') {
    if (lowerMessage === 'confirmar' || lowerMessage.includes('continuar') || lowerMessage.includes('siguiente')) {
      session.state = 'COLLECTING_ADDRESS';
      await saveSession(session, supabase);
      return `📍 *Perfecto! Ahora necesito tu dirección de entrega*\n\n` +
             `Por favor escribe tu dirección completa.\n` +
             `Ejemplo: "Av. Principal 123, San Isidro"\n\n` +
             `_Escribe *cancelar* para volver al inicio._`;
    }

    // Agregar más productos
    const product = await findProductFromMessage(lowerMessage, session.context?.selected_vendor_id!, supabase);
    if (product) {
      session.state = 'ADDING_ITEMS';
      session.context = session.context || {};
      session.context.pending_product = product;
      await saveSession(session, supabase);
      return `🛒 *${product.name}* - $${product.price}\n\n` +
             `¿Cuántas unidades? (ej: "2", "tres")`;
    }

    return `💡 Escribe el nombre del producto para agregar más, o *confirmar* para continuar.`;
  }

  // Estado: RECOLECTANDO DIRECCIÓN
  if (session.state === 'COLLECTING_ADDRESS') {
    if (lowerMessage.length > 10) {
      session.context = session.context || {};
      session.context.delivery_address = message;
      session.state = 'COLLECTING_PAYMENT';
      await saveSession(session, supabase);
      
      return `💳 *¿Cómo vas a pagar?*\n\n` +
             `1️⃣ Efectivo\n` +
             `2️⃣ Yape\n` +
             `3️⃣ Plin\n` +
             `4️⃣ Tarjeta\n\n` +
             `Escribe el número o nombre del método de pago.`;
    }
    return `❌ Por favor escribe una dirección válida (mínimo 10 caracteres).`;
  }

  // Estado: RECOLECTANDO FORMA DE PAGO
  if (session.state === 'COLLECTING_PAYMENT') {
    const paymentMethod = parsePaymentMethod(lowerMessage);
    if (paymentMethod) {
      session.context = session.context || {};
      session.context.payment_method = paymentMethod;
      session.state = 'CONFIRMING_ORDER';
      await saveSession(session, supabase);
      
      const cart = session.context.cart || [];
      const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
      
      let confirmation = `📋 *CONFIRMA TU PEDIDO*\n\n`;
      confirmation += `🏪 *${session.context.selected_vendor_name}*\n\n`;
      confirmation += `📦 *Productos:*\n`;
      cart.forEach((item: CartItem) => {
        confirmation += `• ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
      });
      confirmation += `\n💰 *Total: $${total.toFixed(2)}*\n`;
      confirmation += `📍 *Entrega:* ${session.context.delivery_address}\n`;
      confirmation += `💳 *Pago:* ${paymentMethod}\n\n`;
      confirmation += `¿Todo correcto?\n`;
      confirmation += `• Escribe *confirmar* para realizar el pedido\n`;
      confirmation += `• Escribe *cancelar* para empezar de nuevo`;
      
      return confirmation;
    }
    return `❌ Por favor elige un método de pago válido (1-4 o el nombre).`;
  }

  // Estado: CONFIRMACIÓN FINAL
  if (session.state === 'CONFIRMING_ORDER') {
    if (lowerMessage === 'confirmar' || lowerMessage === 'si' || lowerMessage === 'ok') {
      // Crear orden en la base de datos
      const orderResult = await createOrder(phone, session, supabase);
      
      if (orderResult.success) {
        session.state = 'ORDER_PLACED';
        session.context = { cart: [] };
        await saveSession(session, supabase);
        
        return `✅ *¡PEDIDO REALIZADO!*\n\n` +
               `📋 Número de pedido: #${orderResult.orderId.substring(0, 8)}\n\n` +
               `${session.context.selected_vendor_name} está preparando tu pedido.\n` +
               `Te notificaremos cuando esté en camino! 🚚\n\n` +
               `💡 Escribe *estado* para ver tu pedido\n` +
               `📝 Escribe *calificar* después de recibir tu orden\n\n` +
               `¡Gracias por tu compra! 😊`;
      }
      
      return `❌ Hubo un problema al crear tu pedido. Escribe *vendedor* para ayuda.`;
    }
    
    return `💡 Escribe *confirmar* para realizar el pedido o *cancelar* para empezar de nuevo.`;
  }

  // Estado: SEGUIMIENTO DE PEDIDO
  if (lowerMessage.includes('estado') || lowerMessage.includes('pedido') || lowerMessage.includes('orden')) {
    return await getOrderStatus(phone, supabase);
  }

  // Estado: CALIFICAR (solo si tiene pedido con ese vendor)
  if (lowerMessage.includes('calificar') && session.context?.selected_vendor_id) {
    return await handleRatingForVendor(message, phone, session.context.selected_vendor_id, supabase);
  }

  // Por defecto
  return await getWelcomeMessage(supabase);
}

// === FUNCIONES DE APOYO ===

async function getWelcomeMessage(supabase: any): Promise<string> {
  return `👋 *¡Hola! Bienvenido*\n\n` +
         `Soy tu asistente de pedidos. ¿Qué te gustaría pedir hoy?\n\n` +
         `Escribe *menu* para empezar 🍕🍔🌮`;
}

async function showVendorSelection(supabase: any): Promise<string> {
  try {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, name, category, average_rating')
      .eq('is_active', true)
      .order('average_rating', { ascending: false })
      .limit(10);

    if (!vendors || vendors.length === 0) {
      return `😕 No hay negocios disponibles ahora.\n\nIntenta más tarde.`;
    }

    let message = `🏪 *¿De dónde quieres pedir?*\n\n`;
    vendors.forEach((v: any, index: number) => {
      message += `${index + 1}. *${v.name}*\n`;
      message += `   📍 ${v.category}\n`;
      if (v.average_rating > 0) {
        message += `   ⭐ ${v.average_rating.toFixed(1)}\n`;
      }
      message += '\n';
    });
    message += `💬 Escribe el número o nombre del negocio.`;

    return message;
  } catch (e) {
    return `❌ Error al cargar negocios. Intenta de nuevo.`;
  }
}

async function findVendorFromMessage(message: string, supabase: any): Promise<{id: string, name: string} | null> {
  // Buscar por número
  const number = parseInt(message);
  if (number > 0) {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .order('average_rating', { ascending: false })
      .limit(20);
    
    if (vendors && vendors[number - 1]) {
      return vendors[number - 1];
    }
  }

  // Buscar por nombre
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('is_active', true)
    .ilike('name', `%${message}%`)
    .maybeSingle();

  return vendor;
}

async function showVendorProducts(vendorId: string, vendorName: string, supabase: any): Promise<string> {
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, price, category')
      .eq('vendor_id', vendorId)
      .eq('is_available', true)
      .order('category', { ascending: true });

    if (!products || products.length === 0) {
      return `😕 ${vendorName} no tiene productos disponibles ahora.\n\nEscribe *menu* para elegir otro negocio.`;
    }

    let message = `🏪 *${vendorName}*\n\n`;
    message += `📋 *MENÚ DISPONIBLE:*\n\n`;

    let currentCategory = '';
    products.forEach((p: any, index: number) => {
      if (p.category !== currentCategory) {
        currentCategory = p.category;
        message += `\n🔸 *${currentCategory}*\n`;
      }
      message += `${index + 1}. *${p.name}* - $${p.price}\n`;
      if (p.description) {
        message += `   ${p.description}\n`;
      }
    });

    message += `\n💡 *¿Qué quieres ordenar?*\n`;
    message += `Escribe el número o nombre del producto.\n\n`;
    message += `_Escribe *vendedor* si necesitas ayuda._`;

    return message;
  } catch (e) {
    return `❌ Error al cargar productos. Intenta de nuevo.`;
  }
}

async function findProductFromMessage(message: string, vendorId: string, supabase: any): Promise<any | null> {
  // Buscar por número
  const number = parseInt(message);
  if (number > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_available', true)
      .order('category');
    
    if (products && products[number - 1]) {
      return products[number - 1];
    }
  }

  // Buscar por nombre
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_available', true)
    .ilike('name', `%${message}%`)
    .maybeSingle();

  return product;
}

function parseQuantity(message: string): number {
  const wordToNumber: { [key: string]: number } = {
    'uno': 1, 'una': 1, 'un': 1,
    'dos': 2,
    'tres': 3,
    'cuatro': 4,
    'cinco': 5,
    'seis': 6,
    'siete': 7,
    'ocho': 8,
    'nueve': 9,
    'diez': 10
  };

  const lower = message.toLowerCase();
  if (wordToNumber[lower]) {
    return wordToNumber[lower];
  }

  const num = parseInt(message);
  return num > 0 && num <= 50 ? num : 0;
}

function parsePaymentMethod(message: string): string | null {
  const lower = message.toLowerCase();
  
  if (lower === '1' || lower.includes('efectivo') || lower.includes('cash')) return 'Efectivo';
  if (lower === '2' || lower.includes('yape')) return 'Yape';
  if (lower === '3' || lower.includes('plin')) return 'Plin';
  if (lower === '4' || lower.includes('tarjeta') || lower.includes('card')) return 'Tarjeta';
  
  return null;
}

async function createOrder(phone: string, session: UserSession, supabase: any): Promise<{success: boolean, orderId?: string}> {
  try {
    const cart = session.context?.cart || [];
    const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        vendor_id: session.context?.selected_vendor_id,
        customer_phone: phone,
        customer_name: phone,
        address: session.context?.delivery_address,
        payment_method: session.context?.payment_method,
        items: cart,
        total: total,
        status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      return { success: false };
    }

    return { success: true, orderId: order.id };
  } catch (e) {
    console.error('Error in createOrder:', e);
    return { success: false };
  }
}

async function startVendorChatForOrder(phone: string, vendorId: string, supabase: any): Promise<string> {
  try {
    const { data: existingChat } = await supabase
      .from('vendor_chats')
      .select('*')
      .eq('customer_phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (existingChat) {
      return `💬 Ya tienes un chat activo con un vendedor.\n\nContinúa escribiendo y te responderán.\n\n_Escribe *cerrar* para terminar el chat._`;
    }

    const { data: chat, error } = await supabase
      .from('vendor_chats')
      .insert({
        vendor_id: vendorId,
        customer_phone: phone,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return `❌ No pudimos conectar con un vendedor. Intenta de nuevo.`;
    }

    await supabase
      .from('chat_messages')
      .insert({
        chat_id: chat.id,
        sender_type: 'system',
        message: `Cliente ${phone} necesita ayuda con su pedido`
      });

    return `✅ *Conectando con un vendedor...*\n\n` +
           `Un representante te atenderá en breve.\n` +
           `Escribe tus preguntas y te responderemos.\n\n` +
           `_Escribe *cerrar* cuando termines._`;
  } catch (e) {
    return `❌ Error al iniciar chat. Intenta de nuevo.`;
  }
}

async function getOrderStatus(phone: string, supabase: any): Promise<string> {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at, total, items')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(3);

    if (!orders || orders.length === 0) {
      return `📦 No tienes pedidos activos.\n\nEscribe *menu* para hacer un nuevo pedido.`;
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

    message += `💬 ¿Necesitas ayuda? Escribe *vendedor*`;

    return message;
  } catch (e) {
    return `❌ Error al consultar pedidos.\n\nEscribe *menu* para volver.`;
  }
}

async function handleRatingForVendor(message: string, phone: string, vendorId: string, supabase: any): Promise<string> {
  try {
    const parts = message.split(' ');
    const rating = parseInt(parts[1]);

    if (!rating || rating < 1 || rating > 5) {
      return `⭐ *CALIFICAR SERVICIO*\n\n` +
             `📝 *Formato:*\n` +
             `calificar [1-5] [comentario opcional]\n\n` +
             `*Ejemplo:* calificar 5 Excelente servicio`;
    }

    const comment = parts.slice(2).join(' ');

    const { data: lastOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_phone', phone)
      .eq('vendor_id', vendorId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastOrder) {
      return `😕 No encontramos pedidos completados para calificar.\n\nEscribe *menu* para hacer un nuevo pedido.`;
    }

    const { error } = await supabase
      .from('vendor_reviews')
      .insert({
        vendor_id: vendorId,
        customer_phone: phone,
        rating: rating,
        comment: comment || null
      });

    if (error) {
      return `❌ Error al guardar calificación.\n\nIntenta de nuevo.`;
    }

    const stars = '⭐'.repeat(rating);
    return `✅ *¡Gracias por tu calificación!*\n\n` +
           `${stars}\n` +
           `${comment ? `"${comment}"` : ''}\n\n` +
           `Tu opinión nos ayuda a mejorar.\n\n` +
           `Escribe *menu* para hacer un nuevo pedido.`;
  } catch (e) {
    return `❌ Error al calificar.\n\nIntenta de nuevo.`;
  }
}
