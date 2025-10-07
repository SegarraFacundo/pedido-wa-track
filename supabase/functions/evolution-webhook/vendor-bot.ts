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
  | 'TRACKING_ORDER'
  | 'RATING_ORDER';

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
    pending_order_id?: string;
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
    let context = {};
    try {
      // Intentar parsear si es JSON válido
      if (data.last_bot_message && data.last_bot_message.startsWith('{')) {
        context = JSON.parse(data.last_bot_message);
      }
    } catch (e) {
      // Si falla el parse, inicializar contexto vacío
      context = { cart: [] };
    }

    const state = (data.previous_state as BotState) || 'SELECTING_VENDOR';
    console.log('Sesión recuperada:', phone, 'Estado:', state);

    return {
      phone: data.phone,
      state,
      context
    };
  }

  // Crear nueva sesión
  console.log('Creando nueva sesión para:', phone);
  const newSession: UserSession = {
    phone,
    state: 'SELECTING_VENDOR',
    context: { cart: [] }
  };
  
  await supabase
    .from('user_sessions')
    .upsert({
      phone,
      previous_state: 'SELECTING_VENDOR',
      last_bot_message: JSON.stringify({ cart: [] }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' });

  return newSession;
}

// Guardar sesión
async function saveSession(session: UserSession, supabase: any): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .upsert({
        phone: session.phone,
        previous_state: session.state,  // Este es el estado actual
        last_bot_message: JSON.stringify(session.context || {}),
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });
    
    console.log('Sesión guardada:', session.phone, 'Estado:', session.state);
  } catch (e) {
    console.error('Error guardando sesión:', e);
  }
}

export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // COMANDOS GLOBALES - Verificar PRIMERO antes que cualquier otra cosa
  
  // Menu/Inicio/Hola - Cierra cualquier chat activo y va DIRECTO a selección de vendedores
  if (lowerMessage === 'menu' || lowerMessage === 'inicio' || lowerMessage === 'empezar' || lowerMessage === 'hola' || lowerMessage === 'hi' || lowerMessage === 'buenos dias' || lowerMessage === 'buenas tardes' || lowerMessage === 'buenas noches') {
    // Cerrar chat activo si existe
    await supabase
      .from('vendor_chats')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('customer_phone', phone)
      .eq('is_active', true);

    // Crear sesión nueva
    const newSession: UserSession = {
      phone,
      state: 'SELECTING_VENDOR',
      context: { cart: [] }
    };
    await saveSession(newSession, supabase);
    
    const welcomeMsg = `👋 *¡Bienvenido a Lapacho!*\n\n` +
           `Tu plataforma de pedidos y entregas.\n\n` +
           await showVendorSelection(supabase);
    return welcomeMsg;
  }

  // Soporte de Lapacho - Crear ticket
  if (lowerMessage === 'soporte' || lowerMessage === 'ayuda lapacho' || lowerMessage === 'ayuda sistema') {
    try {
      // Crear ticket de soporte
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          customer_phone: phone,
          customer_name: null,
          subject: 'Solicitud de soporte desde WhatsApp',
          status: 'open',
          priority: 'normal'
        })
        .select()
        .single();

      if (ticketError) {
        console.error('Error creando ticket:', ticketError);
        return `❌ Error al crear ticket de soporte.\n\n` +
               `Intenta más tarde o contacta directamente:\n` +
               `📧 Email: soporte@lapacho.com\n` +
               `📱 WhatsApp: +51 999 999 999`;
      }

      // Crear mensaje inicial del ticket
      await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'customer',
          sender_id: null,
          message: message
        });

      return `🎫 *TICKET DE SOPORTE CREADO*\n\n` +
             `✅ Tu solicitud ha sido registrada.\n` +
             `📋 Ticket #${ticket.id.substring(0, 8)}\n\n` +
             `Un agente de soporte de Lapacho te contactará pronto.\n\n` +
             `📧 Email: soporte@lapacho.com\n` +
             `📱 WhatsApp: +51 999 999 999\n` +
             `🌐 Web: https://tu-sitio.lovable.app/ayuda\n\n` +
             `Horario: Lun-Dom 8am-10pm`;
    } catch (e) {
      console.error('Error en creación de ticket:', e);
      return `❌ Error al crear ticket.\n\nContacta: soporte@lapacho.com`;
    }
  }

  if (lowerMessage === 'ayuda' || lowerMessage === 'help' || lowerMessage === 'comandos') {
    const helpMsg = `ℹ️ *CENTRO DE AYUDA*\n\n` +
           `📖 *Manual de uso:*\n` +
           `https://tu-sitio.lovable.app/ayuda\n\n` +
           `💬 Comandos útiles:\n` +
           `• *menu* - Ver negocios\n` +
           `• *estado* - Ver tu pedido\n` +
           `• *vendedor* | *negocio* | *local* - Hablar con vendedor\n` +
           `• *soporte* - Contactar a Lapacho\n` +
           `• *cancelar* - Cancelar pedido`;
    return addHelpFooter(helpMsg);
  }

  if (lowerMessage === 'cancelar' || lowerMessage === 'salir') {
    // Cerrar chat activo si existe
    await supabase
      .from('vendor_chats')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('customer_phone', phone)
      .eq('is_active', true);

    const session = await getSession(phone, supabase);
    session.state = 'SELECTING_VENDOR';
    session.context = { cart: [] };
    await saveSession(session, supabase);
    return `❌ Pedido cancelado.\n\n` + await showVendorSelection(supabase);
  }

  // Obtener sesión
  const session = await getSession(phone, supabase);

  // Verificar chat con vendedor humano DESPUÉS de comandos globales
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
      
      session.state = 'WELCOME';
      session.context = { cart: [] };
      await saveSession(session, supabase);
      
      return `✅ Chat cerrado.\n\nEscribe *menu* para volver a empezar.`;
    }

    await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender_type: 'customer',
        message: message
      });
    
    return `📩 Mensaje enviado al vendedor.\n\n_Escribe *cerrar* para terminar el chat o *menu* para volver al inicio._`;
  }

  // FLUJO PRINCIPAL DEL BOT VENDEDOR
  
  // Ya no necesitamos el estado WELCOME porque "menu" y "hola" van directo a SELECTING_VENDOR
  
  // Estado: SELECCIONANDO VENDEDOR/NEGOCIO
  if (session.state === 'SELECTING_VENDOR') {
    // Primero intentar parsear como número
    const number = parseInt(lowerMessage);
    
    if (!isNaN(number) && number > 0 && number <= 20) {
      // Es un número válido, buscar vendor
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('average_rating', { ascending: false })
        .limit(20);
      
      if (vendors && vendors[number - 1]) {
        const vendor = vendors[number - 1];
        session.context = { cart: [] };
        session.context.selected_vendor_id = vendor.id;
        session.context.selected_vendor_name = vendor.name;
        session.state = 'BROWSING_PRODUCTS';
      await saveSession(session, supabase);
      return await showVendorProducts(vendor.id, vendor.name, supabase);
      }
    }
    
    // Buscar por nombre
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .ilike('name', `%${lowerMessage}%`)
      .maybeSingle();
    
    if (vendor) {
      session.context = { cart: [] };
      session.context.selected_vendor_id = vendor.id;
      session.context.selected_vendor_name = vendor.name;
      session.state = 'BROWSING_PRODUCTS';
      await saveSession(session, supabase);
      return await showVendorProducts(vendor.id, vendor.name, supabase);
    }
    
    // No encontró el negocio
    return `🤔 No encontré ese negocio.\n\n` + await showVendorSelection(supabase);
  }

  // Estado: NAVEGANDO PRODUCTOS
  if (session.state === 'BROWSING_PRODUCTS') {
    // Opción: hablar con vendedor humano
    if (lowerMessage.includes('vendedor') || lowerMessage.includes('negocio') || lowerMessage.includes('local') || lowerMessage.includes('comercio')) {
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
           `Escribe el nombre del producto que quieres agregar.`;
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
        cartSummary += `• Escribe *confirmar* para continuar\n`;
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
      // Guardar nombre del vendedor antes de limpiar el contexto
      const vendorName = session.context?.selected_vendor_name || 'El vendedor';
      
      // Crear orden en la base de datos
      const orderResult = await createOrder(phone, session, supabase);
      
      if (orderResult.success) {
        session.state = 'ORDER_PLACED';
        session.context = { cart: [] };
        await saveSession(session, supabase);
        
        const successMsg = `✅ *¡PEDIDO REALIZADO!*\n\n` +
               `📋 Número de pedido: #${orderResult.orderId.substring(0, 8)}\n\n` +
               `${vendorName} está preparando tu pedido.\n` +
               `Te notificaremos cuando esté en camino! 🚚\n\n` +
               `💡 Escribe *estado* para ver tu pedido\n` +
               `📝 Escribe *calificar* después de recibir tu orden\n\n` +
               `¡Gracias por tu compra! 😊`;
        return successMsg;
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

  // Estado: RATING_ORDER - Calificación después de entrega
  if (session.state === 'RATING_ORDER') {
    const rating = parseInt(lowerMessage);
    
    // Si escriben "no" o "omitir", saltear calificación
    if (lowerMessage === 'no' || lowerMessage === 'omitir' || lowerMessage === 'skip') {
      session.state = 'SELECTING_VENDOR';
      session.context = { cart: [] };
      await saveSession(session, supabase);
      return `✅ ¡Gracias por usar nuestro servicio!\n\nEscribe *menu* cuando quieras pedir de nuevo.`;
    }
    
    // Validar calificación
    if (!rating || rating < 1 || rating > 5) {
      return `⭐ *Por favor califica del 1 al 5*\n\n` +
             `1️⃣ Muy malo\n` +
             `2️⃣ Malo\n` +
             `3️⃣ Regular\n` +
             `4️⃣ Bueno\n` +
             `5️⃣ Excelente\n\n` +
             `Escribe solo el número (o "omitir" para saltar)`;
    }
    
    // Guardar calificación
    try {
      const { error } = await supabase
        .from('vendor_reviews')
        .insert({
          vendor_id: session.context?.selected_vendor_id,
          customer_phone: phone,
          rating: rating,
          comment: null
        });
      
      if (error) {
        console.error('Error guardando calificación:', error);
      }
      
      // Resetear sesión
      session.state = 'SELECTING_VENDOR';
      session.context = { cart: [] };
      await saveSession(session, supabase);
      
      const stars = '⭐'.repeat(rating);
      return `${stars}\n\n✅ *¡Gracias por tu calificación!*\n\n` +
             `Tu opinión nos ayuda a mejorar el servicio.\n\n` +
             `Escribe *menu* cuando quieras pedir de nuevo.`;
    } catch (e) {
      console.error('Error al guardar calificación:', e);
      return `❌ Error al guardar tu calificación.\n\nEscribe *menu* para continuar.`;
    }
  }

  // Por defecto - Si no entendió nada, dar ayuda según el estado actual
  if (session.state === 'SELECTING_VENDOR') {
    const defaultMsg = `🤔 No entendí.\n\n` + await showVendorSelection(supabase);
    return addHelpFooter(defaultMsg, false);
  }
  
  if (session.state === 'BROWSING_PRODUCTS' && session.context?.selected_vendor_name) {
    const defaultMsg = `🤔 No encontré ese producto en ${session.context.selected_vendor_name}.\n\nEscribe el número o nombre del producto, o *menu* para volver.`;
    return addHelpFooter(defaultMsg, true);
  }

  const defaultMsg = `🤔 No entendí tu mensaje.\n\nEscribe *menu* para empezar o *vendedor* para ayuda.`;
  return addHelpFooter(defaultMsg, session.context?.selected_vendor_id ? true : false);
}

// === FUNCIONES DE APOYO ===

// Footer solo para mensajes de ayuda explícitos
function addHelpFooter(message: string): string {
  let footer = `\n\n━━━━━━━━━━━━━━━\n`;
  footer += `📘 *Ayuda:* https://tu-sitio.lovable.app/ayuda\n`;
  footer += `💬 *Negocio:* vendedor | comercio | local\n`;
  footer += `🆘 *Soporte:* soporte | ayuda`;
  
  return message + footer;
}

async function getWelcomeMessage(supabase: any): Promise<string> {
  return `👋 *¡Hola! Bienvenido*\n\n` +
         `Soy tu asistente de pedidos. ¿Qué te gustaría pedir hoy?\n\n` +
         `Escribe *menu* para empezar 🍕🍔🌮`;
}

async function showVendorSelection(supabase: any): Promise<string> {
  try {
    console.log('📋 Consultando negocios disponibles...');
    
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('id, name, category, average_rating')
      .eq('is_active', true)
      .eq('payment_status', 'active')
      .order('average_rating', { ascending: false })
      .limit(10);

    console.log('📊 Resultado consulta:', { vendorsCount: vendors?.length, error });

    if (error) {
      console.error('❌ Error DB:', error);
      return `❌ Error al consultar negocios.\n\nEscribe *soporte* para ayuda.`;
    }

    if (!vendors || vendors.length === 0) {
      console.warn('⚠️ No hay vendors activos');
      return `😕 No hay negocios disponibles en este momento.\n\nIntenta más tarde o escribe *soporte* para ayuda.`;
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
    message += `💬 Escribe el número del negocio (ej: "1", "2")`;

    console.log('✅ Mensaje generado exitosamente, vendors:', vendors.length);
    return message;
  } catch (e) {
    console.error('💥 Error crítico en showVendorSelection:', e);
    return `❌ Error del sistema.\n\nEscribe *soporte* para reportar este problema.`;
  }
}

async function findVendorFromMessage(message: string, supabase: any): Promise<{id: string, name: string} | null> {
  console.log('Buscando vendor con mensaje:', message);
  
  // Buscar por número
  const number = parseInt(message);
  console.log('Número parseado:', number);
  
  if (number > 0) {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('is_active', true)
      .order('average_rating', { ascending: false })
      .limit(20);
    
    console.log('Vendors disponibles:', vendors?.length);
    
    if (vendors && vendors[number - 1]) {
      console.log('Vendor seleccionado:', vendors[number - 1]);
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

  console.log('Vendor por nombre:', vendor);
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
