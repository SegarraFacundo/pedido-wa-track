// Función para normalizar números de teléfono argentinos
// Garantiza formato consistente: 549 + código de área + número (sin espacios ni caracteres especiales)
function normalizeArgentinePhone(phone: string): string {
  // Limpiar el número: remover espacios, guiones, paréntesis, etc.
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Si ya tiene formato correcto 549XXXXXXXXXX (13 dígitos), retornar
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    return cleaned;
  }
  
  // Si tiene 54 sin el 9: 54XXXXXXXXXX (12 dígitos) -> agregar el 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    return '549' + cleaned.substring(2);
  }
  
  // Si empieza con 9: 9XXXXXXXXXX (11 dígitos) -> agregar 54
  if (cleaned.startsWith('9') && cleaned.length === 11) {
    return '54' + cleaned;
  }
  
  // Si es número local sin código de país: XXXXXXXXXX (10 dígitos) -> agregar 549
  if (!cleaned.startsWith('54') && cleaned.length === 10) {
    return '549' + cleaned;
  }
  
  // Si tiene otros formatos, intentar extraer los últimos dígitos relevantes
  // y construir el formato correcto
  if (cleaned.length > 13) {
    // Probablemente tiene caracteres extra, tomar los últimos 13 o 12 dígitos
    const relevant = cleaned.slice(-13);
    return normalizeArgentinePhone(relevant);
  }
  
  // Si nada coincide, retornar tal cual (edge case)
  return cleaned;
}

// Estados posibles del bot - flujo de pedido completo
type BotState = 
  | 'WELCOME'
  | 'SEARCHING_PRODUCTS'  // Nuevo estado para búsqueda
  | 'VIEWING_SEARCH_RESULTS'  // Nuevo estado para resultados
  | 'SELECTING_VENDOR'
  | 'BROWSING_PRODUCTS'
  | 'ADDING_ITEMS'
  | 'CONFIRMING_ITEMS'
  | 'COLLECTING_ADDRESS'
  | 'COLLECTING_PAYMENT'
  | 'AWAITING_RECEIPT'  // Nuevo estado para esperar comprobante
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
    search_query?: string;  // Nuevo campo para la búsqueda
    search_results?: any[];  // Nuevo campo para resultados
    selected_vendor_id?: string;
    selected_vendor_name?: string;
    cart?: CartItem[];
    delivery_address?: string;
    payment_method?: string;
    payment_receipt_url?: string;  // Nuevo campo para comprobante
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

    const state = (data.previous_state as BotState) || 'SEARCHING_PRODUCTS';  // Actualizado
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
    state: 'SEARCHING_PRODUCTS',  // Nuevo estado inicial
    context: { cart: [] }
  };
  
  await supabase
    .from('user_sessions')
    .upsert({
      phone,
      previous_state: 'SEARCHING_PRODUCTS',  // Actualizado
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

// === FUNCIONES DE INTERPRETACIÓN INTELIGENTE ===

function detectNegation(message: string): boolean {
  const negativePatterns = [
    'no', 'nope', 'nah', 'ninguno', 'ninguna', 'no quiero',
    'no lo quiero', 'no eso', 'mejor no', 'dejalo', 'déjalo',
    'cancelar', 'quitar', 'eliminar', 'borrar', 'sacar'
  ];
  const lowerMsg = message.toLowerCase().trim();
  return negativePatterns.some(pattern => lowerMsg.includes(pattern));
}

function detectAffirmation(message: string): boolean {
  const affirmativePatterns = [
    'si', 'sí', 'sep', 'dale', 'ok', 'okay', 'confirmar',
    'confirmo', 'correcto', 'exacto', 'va', 'claro'
  ];
  const lowerMsg = message.toLowerCase().trim();
  return affirmativePatterns.some(pattern => lowerMsg === pattern || lowerMsg.startsWith(pattern + ' '));
}

function detectBackCommand(message: string): boolean {
  const backPatterns = [
    'volver', 'atras', 'atrás', 'regresar', 'anterior'
  ];
  const lowerMsg = message.toLowerCase().trim();
  return backPatterns.some(pattern => lowerMsg.includes(pattern));
}

function detectRemoveLast(message: string): boolean {
  const removePatterns = [
    'quitar ultimo', 'quitar último', 'borrar ultimo', 'borrar último',
    'eliminar ultimo', 'eliminar último', 'sacar ultimo', 'sacar último',
    'quita el ultimo', 'quita el último'
  ];
  const lowerMsg = message.toLowerCase().trim();
  return removePatterns.some(pattern => lowerMsg.includes(pattern));
}

// Función para normalizar texto removiendo acentos
function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any,
  receiptUrl?: string
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // COMANDOS GLOBALES - Verificar PRIMERO antes que cualquier otra cosa
  
  // Comando para hablar con vendedor
  if (lowerMessage === 'vendedor' || 
      lowerMessage.includes('hablar con vendedor') || 
      lowerMessage.includes('hablar con el vendedor') || 
      lowerMessage.includes('comunicarse con el vendedor') || 
      lowerMessage.includes('comunicarme con vendedor') ||
      lowerMessage.includes('quiero hablar con el vendedor')) {
    // Obtener sesión actual para ver si hay un pedido activo
    const session = await getSession(phone, supabase);
    
    // Verificar si hay un pedido activo
    const { data: activeOrder } = await supabase
      .from('orders')
      .select('id, vendor_id, vendor:vendors(name, phone, whatsapp_number)')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!activeOrder) {
      return `⚠️ No tienes pedidos activos en este momento.\n\nPrimero realiza un pedido para poder hablar con el vendedor.\n\nEscribe "menu" para comenzar.`;
    }
    
    // Activar modo chat con vendedor
    await supabase
      .from('user_sessions')
      .upsert({
        phone,
        in_vendor_chat: true,
        assigned_vendor_phone: activeOrder.vendor.whatsapp_number || activeOrder.vendor.phone,
        previous_state: session.state,
        last_bot_message: JSON.stringify(session.context || {}),
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });
    
    // Crear o reactivar vendor_chat
    const { data: existingChat } = await supabase
      .from('vendor_chats')
      .select('id')
      .eq('customer_phone', phone)
      .eq('vendor_id', activeOrder.vendor_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!existingChat) {
      await supabase
        .from('vendor_chats')
        .insert({
          vendor_id: activeOrder.vendor_id,
          customer_phone: phone,
          is_active: true
        });
    }
    
    // Notificar al vendedor
    await supabase
      .from('customer_messages')
      .insert({
        customer_phone: phone,
        message: `🔔 El cliente quiere hablar contigo directamente.`,
        read: false
      });
    
    return `✅ Chat directo activado con *${activeOrder.vendor.name}*\n\n` +
           `El bot está desactivado. Ahora puedes escribir directamente al vendedor.\n\n` +
           `💬 Escribe tus mensajes y el vendedor los recibirá.\n\n` +
           `Para volver al bot, escribe *"menu"* o *"inicio"*`;
  }
  
  // Menu/Inicio/Hola - Cierra cualquier chat activo y va DIRECTO a búsqueda de productos
  if (lowerMessage === 'menu' || lowerMessage === 'inicio' || lowerMessage === 'empezar' || lowerMessage === 'hola' || lowerMessage === 'hi' || lowerMessage === 'buenos dias' || lowerMessage === 'buenas tardes' || lowerMessage === 'buenas noches') {
    // Cerrar chat activo si existe
    await supabase
      .from('vendor_chats')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('customer_phone', phone)
      .eq('is_active', true);

    // Desactivar modo chat con vendedor
    await supabase
      .from('user_sessions')
      .update({ 
        in_vendor_chat: false, 
        assigned_vendor_phone: null,
        updated_at: new Date().toISOString()
      })
      .eq('phone', phone);

    // Crear sesión nueva con estado de búsqueda
    const newSession: UserSession = {
      phone,
      state: 'SEARCHING_PRODUCTS',
      context: { cart: [] }
    };
    await saveSession(newSession, supabase);
    
    const welcomeMsg = `¡Hola 👋! Soy tu asistente de pedidos.\n\n` +
           `Puedo ayudarte a pedir comida 🍗, helado 🍦, medicamentos 💊, bebidas 🧃, frutas 🥦 o lo que necesites.\n\n` +
           `¿Qué te gustaría pedir hoy?`;
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

  if (lowerMessage === 'cancelar' || lowerMessage === 'salir' || 
      lowerMessage.includes('cancelar pedido') || lowerMessage.includes('cancelar orden') ||
      lowerMessage === 'cancelar todo') {
    // Cancelar pedidos activos pendientes
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed'])
      .limit(5);

    if (activeOrders && activeOrders.length > 0) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('customer_phone', phone)
        .in('status', ['pending', 'confirmed']);
    }

    // Cerrar chat activo si existe
    await supabase
      .from('vendor_chats')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('customer_phone', phone)
      .eq('is_active', true);

    const session = await getSession(phone, supabase);
    session.state = 'SEARCHING_PRODUCTS';
    session.context = { cart: [] };
    await saveSession(session, supabase);
    
    const cancelMsg = activeOrders && activeOrders.length > 0
      ? `❌ Pedido cancelado exitosamente.\n\n🔍 ¿Qué estás buscando?\n\nEscribe lo que quieres pedir (ej: pizza, hamburguesa)`
      : `❌ Pedido cancelado.\n\n🔍 ¿Qué estás buscando?\n\nEscribe lo que quieres pedir (ej: pizza, hamburguesa)`;
    
    return cancelMsg;
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
  
  // Estado: BUSCANDO PRODUCTOS
  if (session.state === 'SEARCHING_PRODUCTS') {
    console.log('Estado SEARCHING_PRODUCTS, procesando búsqueda:', message);
    
    // Llamar a la función de búsqueda
    const { data: searchData, error: searchError } = await supabase.functions.invoke('search-products', {
      body: { searchQuery: message }
    });

    if (searchError) {
      console.error('Error en búsqueda:', searchError);
      return `Ups, hubo un problema al buscar 😅\n\nPor favor intenta de nuevo o escribe *soporte* si persiste.`;
    }

    if (!searchData.found || searchData.results.length === 0) {
      return `😕 No encontré negocios abiertos que tengan *"${message}"*.\n\n` +
             `¿Querés buscar otra cosa?\n` +
             `Por ejemplo: pizza, hamburguesa, helado, empanadas...`;
    }

    // Guardar resultados en sesión
    session.context = session.context || {};
    session.context.search_query = message;
    session.context.search_results = searchData.results;
    session.state = 'VIEWING_SEARCH_RESULTS';
    await saveSession(session, supabase);

    // Mostrar resultados
    let response = `Perfecto 😊, estoy buscando negocios abiertos que tengan *${message}*...\n\n`;
    response += `Te muestro lo que encontré 👇\n\n`;
    
    searchData.results.forEach((result: any, index: number) => {
      response += `${index + 1}. *${result.vendor.name}*\n`;
      response += `   📍 ${result.vendor.category}\n`;
      if (result.vendor.average_rating > 0) {
        response += `   ⭐ ${result.vendor.average_rating.toFixed(1)}\n`;
      }
      response += `   🛒 ${result.products.length} productos disponibles\n`;
      response += `\n`;
    });
    
    response += `💬 Escribe el número del negocio para ver su menú`;
    
    return response;
  }

  // Estado: VIENDO RESULTADOS DE BÚSQUEDA
  if (session.state === 'VIEWING_SEARCH_RESULTS') {
    const number = parseInt(lowerMessage);
    
    if (!isNaN(number) && number > 0 && session.context?.search_results) {
      const selectedResult = session.context.search_results[number - 1];
      
      if (selectedResult) {
        const vendor = selectedResult.vendor;
        session.context.selected_vendor_id = vendor.id;
        session.context.selected_vendor_name = vendor.name;
        session.state = 'BROWSING_PRODUCTS';
        await saveSession(session, supabase);
        
        const catalogMsg = `Perfecto 👌 estás comprando en *${vendor.name}*.\n\n` +
                          `Te muestro el catálogo:\n\n`;
        const productsMsg = await showVendorProducts(vendor.id, vendor.name, supabase);
        return catalogMsg + productsMsg.split('\n\n').slice(1).join('\n\n');
      }
    }
    
    // Nueva búsqueda
    if (lowerMessage.length > 2) {
      session.state = 'SEARCHING_PRODUCTS';
      await saveSession(session, supabase);
      
      // Recursivamente procesar como nueva búsqueda
      return await handleVendorBot(message, phone, supabase);
    }
    
    return `🤔 Opción inválida.\n\n` +
           `Escribe el número del negocio (1-${session.context?.search_results?.length || 0})\n` +
           `O escribe otro producto para buscar`;
  }
  
  // Ya no necesitamos el estado WELCOME porque "menu" y "hola" van directo a SEARCHING_PRODUCTS
  
  // Estado: SELECCIONANDO VENDEDOR/NEGOCIO (mantenido para compatibilidad)
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

    // Detectar múltiples productos (ej: "4 y 6", "1, 3, 5", "2 y 4")
    const multiplePattern = /(\d+)\s*(?:y|,|and)\s*(\d+)/gi;
    const matches = message.match(multiplePattern);
    
    if (matches) {
      // Extraer todos los números del mensaje
      const numbers = message.match(/\d+/g)?.map(n => parseInt(n)) || [];
      
      if (numbers.length > 1) {
        // Guardar los números pendientes para procesar
        session.context = session.context || {};
        session.context.pending_product_numbers = numbers;
        session.context.current_product_index = 0;
        await saveSession(session, supabase);
        
        // Buscar el primer producto
        const firstProduct = await findProductFromMessage(numbers[0].toString(), session.context?.selected_vendor_id!, supabase);
        if (firstProduct) {
          session.state = 'ADDING_ITEMS';
          session.context.pending_product = firstProduct;
          await saveSession(session, supabase);
          
          return `🛒 *Producto ${numbers[0]}/${numbers.length}*\n\n` +
                 `*${firstProduct.name}* - $${firstProduct.price}\n\n` +
                 `¿Cuántas unidades quieres? (ej: "2", "tres")\n\n` +
                 `_Luego te preguntaré por los demás productos._`;
        }
      }
    }

    // Buscar producto con interpretación inteligente
    const product = await findProductFromMessage(lowerMessage, session.context?.selected_vendor_id!, supabase);
    if (product) {
      session.state = 'ADDING_ITEMS';
      session.context = session.context || {};
      session.context.pending_product = product;
      await saveSession(session, supabase);
      return `Perfecto 😋, agregando *${product.name}* - $${product.price}\n\n` +
             `¿Cuántas unidades querés? (escribe "2", "tres", etc.)\n\n` +
             `_Escribe *no* si no querés este producto._`;
    }
    
    // Si no encontró producto, intentar interpretar mejor el mensaje
    if (lowerMessage.length > 3) {
      return `🤔 No encontré *"${message}"* en el menú.\n\n` +
             `¿Podrías escribir el nombre del producto que buscas?\n` +
             `O escribe *menu* para ver otros negocios.`;
    }
    
    return `🤔 No encontré ese producto.\n\n` +
           `Escribe el nombre del producto que quieres agregar.`;
  }

  // Estado: AGREGANDO CANTIDAD
  if (session.state === 'ADDING_ITEMS') {
    // Detectar si el usuario dice "no" o quiere cancelar este producto
    if (detectNegation(lowerMessage) || detectBackCommand(lowerMessage)) {
      delete session.context?.pending_product;
      
      // Si tiene items en el carrito, volver a CONFIRMING_ITEMS
      if (session.context?.cart && session.context.cart.length > 0) {
        session.state = 'CONFIRMING_ITEMS';
        await saveSession(session, supabase);
        
        const cart = session.context.cart;
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        
        let cartSummary = `🔙 *Producto cancelado*\n\n`;
        cartSummary += `📦 *Tu pedido actual:*\n`;
        cart.forEach((item: CartItem) => {
          cartSummary += `• ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Quieres agregar algo más?\n`;
        cartSummary += `• Escribe el producto para agregar\n`;
        cartSummary += `• Escribe *confirmar* para continuar`;
        
        return cartSummary;
      } else {
        // Si no hay items, volver a BROWSING_PRODUCTS
        session.state = 'BROWSING_PRODUCTS';
        await saveSession(session, supabase);
        return `🔙 Producto cancelado.\n\n` +
               `Escribe el nombre del producto que quieres agregar.`;
      }
    }

    const quantity = parseQuantity(lowerMessage);
    if (quantity > 0) {
      const product = session.context?.pending_product;
      if (product) {
        // Verificar si el producto tiene stock sin stock
        if (product.out_of_stock) {
          session.state = 'BROWSING_PRODUCTS';
          delete session.context.pending_product;
          await saveSession(session, supabase);
          return `😔 Lo siento, *${product.name}* está agotado temporalmente.\n\n` +
                 `Escribe el nombre de otro producto que quieras agregar.`;
        }
        
        // Validar stock si está habilitado
        if (product.stock_enabled) {
          const availableStock = product.stock_quantity || 0;
          if (quantity > availableStock) {
            return `⚠️ Lo siento, solo hay *${availableStock}* ${availableStock === 1 ? 'unidad' : 'unidades'} disponibles de *${product.name}*.\n\n` +
                   `¿Cuántas unidades quieres? (máximo ${availableStock})\n\n` +
                   `_O escribe *no* para cancelar._`;
          }
        }
        
        session.context = session.context || {};
        session.context.cart = session.context.cart || [];
        session.context.cart.push({
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          price: product.price
        });
        delete session.context.pending_product;

        // Verificar si hay más productos pendientes de la selección múltiple
        if (session.context.pending_product_numbers && 
            session.context.current_product_index !== undefined &&
            session.context.current_product_index < session.context.pending_product_numbers.length - 1) {
          
          // Pasar al siguiente producto
          session.context.current_product_index++;
          const nextProductNumber = session.context.pending_product_numbers[session.context.current_product_index];
          const nextProduct = await findProductFromMessage(nextProductNumber.toString(), session.context?.selected_vendor_id!, supabase);
          
          if (nextProduct) {
            session.state = 'ADDING_ITEMS';
            session.context.pending_product = nextProduct;
            await saveSession(session, supabase);
            
            return `✅ Agregado!\n\n` +
                   `🛒 *Producto ${session.context.current_product_index + 1}/${session.context.pending_product_numbers.length}*\n\n` +
                   `*${nextProduct.name}* - $${nextProduct.price}\n\n` +
                   `¿Cuántas unidades quieres? (ej: "2", "tres")`;
          }
        }
        
        // No hay más productos pendientes, mostrar resumen del carrito
        delete session.context.pending_product_numbers;
        delete session.context.current_product_index;

        session.state = 'CONFIRMING_ITEMS';
        await saveSession(session, supabase);
        
        const cart = session.context.cart;
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        
        let cartSummary = `✅ *Agregado al carrito*\n\n`;
        cartSummary += `Esto es lo que llevás hasta ahora 🛒:\n\n`;
        cart.forEach((item: CartItem, index: number) => {
          cartSummary += `${index + 1}. ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Querés agregar algo más o confirmamos el pedido?\n\n`;
        cartSummary += `• Escribe otro producto para agregar\n`;
        cartSummary += `• Escribe *quitar [número]* para eliminar un producto\n`;
        cartSummary += `• Escribe *confirmar* para continuar`;
        
        return cartSummary;
      }
    }
    return `❌ Por favor escribe una cantidad válida (ej: "2", "tres")\n\n_O escribe *no* para cancelar este producto._`;
  }

  // Estado: CONFIRMANDO ITEMS
  if (session.state === 'CONFIRMING_ITEMS') {
    // Detectar si quiere eliminar un producto específico por número o nombre
    const removeMatch = lowerMessage.match(/(?:quitar|eliminar|sacar|borrar)\s+(?:el\s+)?(.+)/i);
    if (removeMatch) {
      const itemToRemove = removeMatch[1].trim();
      const cart = session.context?.cart || [];
      
      // Buscar por número (índice en el carrito)
      const itemNumber = parseInt(itemToRemove);
      if (!isNaN(itemNumber) && itemNumber > 0 && itemNumber <= cart.length) {
        const removedItem = cart.splice(itemNumber - 1, 1)[0];
        session.context = session.context || {};
        session.context.cart = cart;
        await saveSession(session, supabase);
        
        if (cart.length === 0) {
          session.state = 'BROWSING_PRODUCTS';
          await saveSession(session, supabase);
          return `🗑️ *${removedItem.product_name}* eliminado del carrito.\n\n` +
                 `Tu carrito está vacío.\n` +
                 `Escribe el nombre del producto que quieres agregar.`;
        }
        
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        let cartSummary = `🗑️ *${removedItem.product_name}* eliminado del carrito.\n\n`;
        cartSummary += `📦 *Tu pedido actualizado:*\n`;
        cart.forEach((item: CartItem, index: number) => {
          cartSummary += `${index + 1}. ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Quieres agregar algo más o confirmar?\n`;
        cartSummary += `• Escribe otro producto para agregar\n`;
        cartSummary += `• Escribe *quitar [número]* para eliminar un producto\n`;
        cartSummary += `• Escribe *confirmar* para continuar`;
        return cartSummary;
      }
      
      // Buscar por nombre del producto
      const normalizedSearch = normalizeText(itemToRemove);
      const itemIndex = cart.findIndex((item: CartItem) => 
        normalizeText(item.product_name).includes(normalizedSearch) ||
        normalizedSearch.includes(normalizeText(item.product_name))
      );
      
      if (itemIndex !== -1) {
        const removedItem = cart.splice(itemIndex, 1)[0];
        session.context = session.context || {};
        session.context.cart = cart;
        await saveSession(session, supabase);
        
        if (cart.length === 0) {
          session.state = 'BROWSING_PRODUCTS';
          await saveSession(session, supabase);
          return `🗑️ *${removedItem.product_name}* eliminado del carrito.\n\n` +
                 `Tu carrito está vacío.\n` +
                 `Escribe el nombre del producto que quieres agregar.`;
        }
        
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        let cartSummary = `🗑️ *${removedItem.product_name}* eliminado del carrito.\n\n`;
        cartSummary += `📦 *Tu pedido actualizado:*\n`;
        cart.forEach((item: CartItem, index: number) => {
          cartSummary += `${index + 1}. ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Quieres agregar algo más o confirmar?\n`;
        cartSummary += `• Escribe otro producto para agregar\n`;
        cartSummary += `• Escribe *quitar [número]* para eliminar un producto\n`;
        cartSummary += `• Escribe *confirmar* para continuar`;
        return cartSummary;
      }
      
      return `❌ No encontré ese producto en tu carrito.\n\n` +
             `Escribe el número o nombre exacto del producto que quieres eliminar.`;
    }
    
    // Detectar si quiere quitar el último producto agregado
    if (detectRemoveLast(lowerMessage)) {
      if (session.context?.cart && session.context.cart.length > 0) {
        const removedItem = session.context.cart.pop();
        await saveSession(session, supabase);
        
        if (session.context.cart.length === 0) {
          // Si no quedan items, volver a BROWSING_PRODUCTS
          session.state = 'BROWSING_PRODUCTS';
          await saveSession(session, supabase);
          return `🗑️ *${removedItem?.product_name}* eliminado del carrito.\n\n` +
                 `Tu carrito está vacío.\n` +
                 `Escribe el nombre del producto que quieres agregar.`;
        }
        
        const cart = session.context.cart;
        const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
        
        let cartSummary = `🗑️ *${removedItem?.product_name}* eliminado del carrito.\n\n`;
        cartSummary += `📦 *Tu pedido actualizado:*\n`;
        cart.forEach((item: CartItem, index: number) => {
          cartSummary += `${index + 1}. ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        cartSummary += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
        cartSummary += `¿Quieres agregar algo más o confirmar?\n`;
        cartSummary += `• Escribe otro producto para agregar\n`;
        cartSummary += `• Escribe *quitar [número]* para eliminar un producto\n`;
        cartSummary += `• Escribe *confirmar* para continuar`;
        
        return cartSummary;
      }
      return `❌ No hay productos en el carrito para eliminar.`;
    }

    if (detectAffirmation(lowerMessage) || lowerMessage === 'confirmar' || lowerMessage.includes('continuar') || lowerMessage.includes('siguiente')) {
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
      // Verificar si está sin stock
      if (product.out_of_stock) {
        return `😔 Lo siento, *${product.name}* está agotado temporalmente.\n\n` +
               `Prueba con otro producto o escribe *confirmar* para continuar con tu pedido actual.`;
      }
      
      session.state = 'ADDING_ITEMS';
      session.context = session.context || {};
      session.context.pending_product = product;
      await saveSession(session, supabase);
      
      let message = `🛒 *${product.name}* - $${product.price}\n\n`;
      if (product.stock_enabled && product.stock_quantity) {
        message += `_Disponibles: ${product.stock_quantity} unidades_\n\n`;
      }
      message += `¿Cuántas unidades? (ej: "2", "tres")\n\n`;
      message += `_Escribe *no* si no quieres este producto._`;
      return message;
    }

    return `💡 Escribe el nombre del producto para agregar más, o *confirmar* para continuar.\n\n` +
           `_También puedes escribir *quitar [número]* para eliminar un producto._`;
  }

  // Estado: RECOLECTANDO DIRECCIÓN
  if (session.state === 'COLLECTING_ADDRESS') {
    if (lowerMessage.length > 10) {
      session.context = session.context || {};
      session.context.delivery_address = message;
      session.state = 'COLLECTING_PAYMENT';
      await saveSession(session, supabase);
      
      return `Gracias 🏡\n\n` +
             `¿Cómo querés pagar?\n\n` +
             `1️⃣ Efectivo al entregar\n` +
             `2️⃣ Transferencia\n` +
             `3️⃣ Tarjeta\n\n` +
             `Escribe el número o nombre del método de pago`;
    }
    return `Por favor, escribe una dirección más completa (mínimo 10 caracteres) para que el delivery pueda encontrarte.`;
  }

  // Estado: RECOLECTANDO FORMA DE PAGO
  if (session.state === 'COLLECTING_PAYMENT') {
    const paymentMethod = parsePaymentMethod(lowerMessage);
    if (paymentMethod) {
      session.context = session.context || {};
      session.context.payment_method = paymentMethod;
      
      // Ir a confirmación para TODOS los métodos de pago
      session.state = 'CONFIRMING_ORDER';
      await saveSession(session, supabase);
      
      const cart = session.context.cart || [];
      const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
      
      let confirmation = paymentMethod === 'Efectivo' 
        ? `Listo 💵, lo pagás al entregar.\n\n`
        : paymentMethod === 'Transferencia'
        ? `💸 *Perfecto, pago por Transferencia*\n\n`
        : `Perfecto 💳, pagás con ${paymentMethod}.\n\n`;
      
      confirmation += `📦 *Tu pedido:*\n`;
      cart.forEach((item: CartItem) => {
        confirmation += `• ${item.quantity}x ${item.product_name} - $${(item.price * item.quantity).toFixed(2)}\n`;
      });
      confirmation += `\n💰 *Total: $${total.toFixed(2)}*\n`;
      confirmation += `🏠 *Entrega:* ${session.context.delivery_address}\n`;
      confirmation += `💳 *Pago:* ${paymentMethod}\n\n`;
      confirmation += `¿Todo correcto? Escribe *confirmar* para finalizar el pedido`;
      
      return confirmation;
    }
    return `❌ Por favor elige un método de pago válido (1-3 o el nombre).`;
  }

  // Estado: ESPERANDO COMPROBANTE
  if (session.state === 'AWAITING_RECEIPT') {
    // Si recibió una URL del comprobante (desde el webhook)
    if (receiptUrl) {
      const orderId = session.context?.pending_order_id;
      const vendorName = session.context?.selected_vendor_name || 'El vendedor';
      
      if (orderId) {
        // Actualizar el pedido existente con el comprobante
        const { error } = await supabase
          .from('orders')
          .update({ payment_receipt_url: receiptUrl })
          .eq('id', orderId);
        
        if (!error) {
          session.state = 'ORDER_PLACED';
          session.context = { cart: [] };
          await saveSession(session, supabase);
          
          return `✅ *Comprobante recibido*\n\n` +
                 `📋 Pedido #${orderId.substring(0, 8)}\n\n` +
                 `*${vendorName}* verificará tu pago y lo está preparando. Llega en aproximadamente 35 minutos 🚴‍♂️\n\n` +
                 `💬 Escribe *estado* para seguir tu pedido\n` +
                 `💬 Escribe *vendedor* para hablar con el negocio\n\n` +
                 `Gracias por pedir con nosotros ❤️`;
        }
      }
      
      // Si no hay orderId o hubo error
      if (orderResult.message) {
        return `⚠️ ${orderResult.message}`;
      }
      
      return `❌ Hubo un problema al crear tu pedido. Intenta nuevamente.`;
    }
    
    // Si no recibió imagen aún
    return `📸 Por favor, envía la *imagen del comprobante* de transferencia.\n\n` +
           `_Adjunta la imagen sin texto adicional._`;
  }

  // Estado: CONFIRMACIÓN FINAL
  if (session.state === 'CONFIRMING_ORDER') {
    if (lowerMessage === 'confirmar' || lowerMessage === 'si' || lowerMessage === 'ok') {
      // Crear orden SIEMPRE, independiente del método de pago
      const vendorName = session.context?.selected_vendor_name || 'El vendedor';
      const orderResult = await createOrder(phone, session, supabase);
      
      if (orderResult.success) {
        // Si el método de pago es Transferencia, pedir comprobante DESPUÉS de crear el pedido
        if (session.context?.payment_method === 'Transferencia') {
          session.state = 'AWAITING_RECEIPT';
          session.context = session.context || {};
          session.context.pending_order_id = orderResult.orderId; // Guardar ID del pedido
          await saveSession(session, supabase);
          
          return `📸 *Perfecto!*\n\n` +
                 `Por favor, envía el comprobante de transferencia para que el vendedor pueda verificar tu pago.\n\n` +
                 `_Adjunta la imagen del comprobante._`;
        }
        
        // Para otros métodos de pago, confirmar inmediatamente
        session.state = 'ORDER_PLACED';
        session.context = { cart: [] };
        await saveSession(session, supabase);
        
        const successMsg = `✅ *Pedido confirmado*\n\n` +
               `📋 Pedido #${orderResult.orderId.substring(0, 8)}\n\n` +
               `*${vendorName}* lo está preparando y llega en aproximadamente 35 minutos 🚴‍♂️\n\n` +
               `💬 Escribe *estado* para seguir tu pedido\n` +
               `💬 Escribe *vendedor* para hablar con el negocio\n\n` +
               `Gracias por pedir con nosotros ❤️`;
        return successMsg;
      }
      
      // Si hay mensaje, es porque ya tiene pedido activo
      if (orderResult.message) {
        return `⚠️ ${orderResult.message}`;
      }
      
      return `❌ Hubo un problema al crear tu pedido. Intenta nuevamente.`;
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
    return defaultMsg;
  }
  
  if (session.state === 'BROWSING_PRODUCTS' && session.context?.selected_vendor_name) {
    return `🤔 No encontré ese producto en ${session.context.selected_vendor_name}.\n\nEscribe el número o nombre del producto.`;
  }

  return `🤔 No entendí tu mensaje.\n\nEscribe *menu* para empezar.`;
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
      .select('id, name, description, price, category, image')
      .eq('vendor_id', vendorId)
      .eq('is_available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

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
      if (p.image) {
        message += `   🖼️ ${p.image}\n`;
      }
    });

    message += `\n💡 *¿Qué quieres ordenar?*\n`;
    message += `Escribe el número o nombre del producto.`;

    return message;
  } catch (e) {
    return `❌ Error al cargar productos. Intenta de nuevo.`;
  }
}

async function findProductFromMessage(message: string, vendorId: string, supabase: any): Promise<any | null> {
  const lowerMessage = message.toLowerCase().trim();
  const normalizedMessage = normalizeText(message);
  
  // Intentar número primero (DEBE coincidir con el orden de showVendorProducts)
  const number = parseInt(lowerMessage);
  if (!isNaN(number) && number > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    if (products && products[number - 1]) {
      const product = products[number - 1];
      // Verificar stock si está habilitado
      if (product.stock_enabled && (product.stock_quantity || 0) === 0) {
        return { ...product, out_of_stock: true };
      }
      return product;
    }
  }
  
  // Buscar por nombre exacto o similar
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_available', true);
  
  if (!products || products.length === 0) return null;
  
  // Intentar coincidencia exacta primero (con y sin acentos)
  const exactMatch = products.find((p: any) => 
    p.name.toLowerCase() === lowerMessage || normalizeText(p.name) === normalizedMessage
  );
  if (exactMatch) {
    // Verificar stock
    if (exactMatch.stock_enabled && (exactMatch.stock_quantity || 0) === 0) {
      return { ...exactMatch, out_of_stock: true };
    }
    return exactMatch;
  }
  
  // Intentar coincidencia parcial (contiene) - con y sin acentos
  const partialMatch = products.find((p: any) => 
    p.name.toLowerCase().includes(lowerMessage) || 
    lowerMessage.includes(p.name.toLowerCase()) ||
    normalizeText(p.name).includes(normalizedMessage) ||
    normalizedMessage.includes(normalizeText(p.name))
  );
  if (partialMatch) {
    // Verificar stock
    if (partialMatch.stock_enabled && (partialMatch.stock_quantity || 0) === 0) {
      return { ...partialMatch, out_of_stock: true };
    }
    return partialMatch;
  }
  
  // Intentar coincidencia por palabras clave - con y sin acentos
  const words = lowerMessage.split(' ').filter((w: string) => w.length > 2);
  const normalizedWords = normalizedMessage.split(' ').filter((w: string) => w.length > 2);
  if (words.length > 0) {
    const keywordMatch = products.find((p: any) => {
      const productWords = p.name.toLowerCase().split(' ');
      const normalizedProductWords = normalizeText(p.name).split(' ');
      return words.some((word: string) => 
        productWords.some((pw: string) => pw.includes(word) || word.includes(pw))
      ) || normalizedWords.some((word: string) => 
        normalizedProductWords.some((pw: string) => pw.includes(word) || word.includes(pw))
      );
    });
    if (keywordMatch) {
      // Verificar stock
      if (keywordMatch.stock_enabled && (keywordMatch.stock_quantity || 0) === 0) {
        return { ...keywordMatch, out_of_stock: true };
      }
      return keywordMatch;
    }
  }
  
  return null;
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
  if (lower === '2' || lower.includes('transferencia') || lower.includes('transfer')) return 'Transferencia';
  if (lower === '3' || lower.includes('tarjeta') || lower.includes('card')) return 'Tarjeta';
  
  return null;
}

async function createOrder(phone: string, session: UserSession, supabase: any): Promise<{success: boolean, orderId?: string, message?: string}> {
  try {
    const cart = session.context?.cart || [];
    const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
    
    // Normalizar el número de teléfono antes de guardarlo
    const normalizedPhone = normalizeArgentinePhone(phone);
    console.log('Creating order - Original phone:', phone, '-> Normalized:', normalizedPhone);

    // Verificar si ya tiene un pedido activo
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('customer_phone', normalizedPhone)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeOrders && activeOrders.length > 0) {
      const activeOrder = activeOrders[0];
      console.log('Active order found:', activeOrder.id);
      return { 
        success: false, 
        message: `Ya tienes un pedido activo (#${activeOrder.id.substring(0, 8)}).\n\n` +
                 `Espera a que se entregue o cancele antes de hacer uno nuevo.\n\n` +
                 `Escribe *estado* para ver tu pedido actual.`
      };
    }

    // Validar stock final antes de crear el pedido
    for (const item of cart) {
      const { data: product } = await supabase
        .from('products')
        .select('stock_enabled, stock_quantity, name')
        .eq('id', item.product_id)
        .single();
      
      if (product && product.stock_enabled) {
        const availableStock = product.stock_quantity || 0;
        if (item.quantity > availableStock) {
          return {
            success: false,
            message: `⚠️ Lo siento, solo hay ${availableStock} ${availableStock === 1 ? 'unidad' : 'unidades'} disponibles de *${product.name}*.\n\n` +
                     `Por favor ajusta tu pedido. Escribe *cancelar* para empezar de nuevo.`
          };
        }
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        vendor_id: session.context?.selected_vendor_id,
        customer_phone: normalizedPhone,
        customer_name: normalizedPhone,
        address: session.context?.delivery_address,
        payment_method: session.context?.payment_method,
        payment_receipt_url: session.context?.payment_receipt_url,
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

    // Restar del stock después de crear el pedido exitosamente
    for (const item of cart) {
      const { data: product } = await supabase
        .from('products')
        .select('stock_enabled, stock_quantity, is_available')
        .eq('id', item.product_id)
        .single();
      
      if (product && product.stock_enabled) {
        const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
        
        // Actualizar stock y deshabilitar si llegó a 0
        await supabase
          .from('products')
          .update({
            stock_quantity: newStock,
            is_available: newStock > 0
          })
          .eq('id', item.product_id);
      }
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

    return message;
  } catch (e) {
    return `❌ Error al consultar pedidos.`;
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
