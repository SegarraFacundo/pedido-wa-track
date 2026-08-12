import OpenAI from "https://esm.sh/openai@4.77.3";
import type { ConversationContext, CartItem } from "./types.ts";
import { getPendingStateForPayment } from "./types.ts";
import { normalizeArgentinePhone } from "./utils.ts";
import { getContext, saveContext } from "./context.ts";
import { tools } from "./tools-definitions.ts";
import { buildSystemPrompt } from "./simplified-prompt.ts";
import { ejecutarHerramienta, setGetVendorConfig, setIsValidAddress } from "./tool-executors.ts";
import { handleShoppingInterceptor } from "./shopping-interceptor.ts";
import { normalizeIntentText, looksLikePurchaseIntent, isOrderConfirmationSignal } from "./bot-helpers.ts";
import {
  PlatformSettings,
  checkPlatformSettings,
  logBotError,
  incrementErrorCount,
  handleEmergencyFallback,
} from "./emergency-handler.ts";

const CART_MODIFICATION_REGEX = /\b(sum[aá](?:me|le)?|sac[aá](?:me|le)?|pon[eé](?:me|le)?|m[aá]s|otro|otra|agreg[aá]|quit[aá]|cambi[aá]|modific[aá])\b/i;

// ==================== NORMALIZACIÓN DE PAGO ====================
function normalizePaymentInput(input: string): string | null {
  const normalized = input.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Frases coloquiales → método
  if (/\b(efectivo|cash|plata en mano|pago al recibir|contra\s*entrega|en mano)\b/.test(normalized)) return 'efectivo';
  if (/\b(transferencia|transfer|transfiero|te transfiero|cbu|alias|deposito|banco|bancaria)\b/.test(normalized)) return 'transferencia';
  if (/\b(mercado\s*pago|mercadopago|mp)\b/.test(normalized)) return 'mercadopago';
  
  return null;
}

// ==================== VALIDACIÓN DE DIRECCIÓN ====================
function isValidAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 5) return false;
  const hasText = /[a-záéíóúñ]{2,}/i.test(trimmed);
  if (!hasText) return false;
  // Accept if it has a number (calle + altura) OR is descriptive enough (10+ chars, e.g. "Nuria, Funes, Santa Fe")
  const hasNumber = /\d+/.test(trimmed);
  if (hasNumber) return true;
  // Allow longer descriptive addresses without numbers (barrio, localidad, references)
  return trimmed.length >= 10;
}




// ==================== HELPER: CONTEXTUAL FALLBACK ====================

function getContextualFallback(context: ConversationContext): string {
  const state = context.order_state || "idle";
  const confusionCount = context.confusion_count || 0;

  // Si el usuario lleva 2+ mensajes sin reconocer, simplificar al máximo
  if (confusionCount >= 2) {
    if (state === "shopping" && context.selected_vendor_name) {
      return `Te ayudo 🙂 Estás en *${context.selected_vendor_name}*.\n\n` +
        `1️⃣ Ver el menú\n2️⃣ Ver tu carrito\n3️⃣ Confirmar pedido\n\n¿Qué preferís?`;
    }
    return `Te ayudo 🙂 ¿Qué querés hacer?\n\n` +
      `1️⃣ Ver negocios abiertos\n2️⃣ Buscar un producto\n\n` +
      `Escribí lo que necesitás.`;
  }

  switch (state) {
    case "idle":
      return "¿Qué te gustaría? Puedo mostrarte negocios abiertos o buscar algo puntual 😊";
    case "browsing":
      return "Decime el número o nombre del negocio que te interesa, o decime qué querés buscar 🙂";
    case "shopping": {
      const cartInfo = context.cart.length > 0
        ? `Tenés ${context.cart.length} producto${context.cart.length > 1 ? 's' : ''} en el carrito. `
        : "";
      return `${cartInfo}¿Querés agregar algo más o confirmar tu pedido?`;
    }
    case "needs_address":
      return "¿A qué dirección te lo mando? 📍";
    case "checkout":
      return "¿Cómo querés pagar? " + (context.available_payment_methods?.join(', ') || "");
    default:
      return "¿En qué te puedo ayudar? 😊";
  }
}

// ==================== FASE 1: FILTRADO DE HERRAMIENTAS POR ESTADO ====================

const TOOLS_BY_STATE: Record<string, string[]> = {
  idle: ["buscar_productos", "ver_locales_abiertos", "mostrar_menu_ayuda", "ver_estado_pedido"],
  browsing: ["ver_menu_negocio", "buscar_productos", "ver_locales_abiertos", "mostrar_menu_ayuda", "ver_estado_pedido", "registrar_calificacion", "calificar_plataforma"],
  shopping: [
    "agregar_al_carrito", "quitar_producto_carrito", "ver_carrito",
    "modificar_carrito_completo", "ver_menu_negocio", "ver_ofertas",
    "seleccionar_tipo_entrega", "confirmar_direccion_entrega",
    "ver_metodos_pago", "seleccionar_metodo_pago",
    "mostrar_resumen_pedido", "vaciar_carrito", "crear_pedido",
    "agregar_nota_producto",
  ],
  needs_address: ["confirmar_direccion_entrega", "vaciar_carrito", "ver_carrito"],
  checkout: ["seleccionar_metodo_pago", "mostrar_resumen_pedido", "crear_pedido", "ver_carrito", "vaciar_carrito"],
  order_pending_cash: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma"],
  order_pending_transfer: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma"],
  order_pending_mp: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma"],
  order_confirmed: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma"],
  order_completed: ["ver_estado_pedido", "registrar_calificacion", "calificar_plataforma", "buscar_productos", "ver_locales_abiertos"],
  order_cancelled: ["buscar_productos", "ver_locales_abiertos", "ver_estado_pedido"],
};

// FASE 4: Herramientas cuya salida se retorna directamente sin reformateo del LLM
const DIRECT_RESPONSE_TOOLS = new Set([
  "ver_locales_abiertos",
  "ver_menu_negocio",
  "ver_carrito",
  "mostrar_resumen_pedido",
  "mostrar_menu_ayuda",
  "ver_estado_pedido",
  "ver_ofertas",
  "buscar_productos",
]);

function filterToolsByState(state: string, _context: ConversationContext) {
  const allowedNames = TOOLS_BY_STATE[state] || TOOLS_BY_STATE["idle"];
  const withSupport = [...allowedNames, "crear_ticket_soporte"];
  return tools.filter(t => withSupport.includes(t.function.name));
}

// ==================== HELPER: REAL-TIME VENDOR CONFIG ====================

// ✅ SIEMPRE consulta la DB para obtener la configuración actual del vendor
// NUNCA usa valores cacheados del contexto para allows_pickup/allows_delivery
async function getVendorConfig(vendorId: string, supabase: any) {
  const { data, error } = await supabase
    .from("vendors")
    .select("allows_pickup, allows_delivery, pickup_instructions, address, is_active, name")
    .eq("id", vendorId)
    .single();
  
  if (error) {
    console.error(`❌ Error fetching vendor config for ${vendorId}:`, error);
  }
  
  return {
    allows_pickup: data?.allows_pickup === true,
    allows_delivery: data?.allows_delivery ?? true, // Default true si no existe
    pickup_instructions: data?.pickup_instructions,
    address: data?.address,
    is_active: data?.is_active ?? true,
    name: data?.name
  };
}

// Wire up forward declarations to avoid circular imports
setGetVendorConfig(getVendorConfig);
setIsValidAddress(isValidAddress);

// ==================== HELPER FUNCTIONS ====================

// Helper function para registrar analytics de cambio de vendor
async function trackVendorChange(
  context: ConversationContext,
  action: 'confirmed' | 'cancelled',
  supabase: any
) {
  try {
    const hashPhone = async (phone: string): Promise<string> => {
      const msgBuffer = new TextEncoder().encode(phone);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
    
    const phoneHash = await hashPhone(context.phone);
    const cartTotal = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    
    await supabase
      .from('vendor_change_analytics')
      .insert({
        user_phone_hash: phoneHash,
        action,
        current_vendor_id: context.selected_vendor_id,
        current_vendor_name: context.selected_vendor_name || 'Unknown',
        pending_vendor_id: context.pending_vendor_change!.new_vendor_id,
        pending_vendor_name: context.pending_vendor_change!.new_vendor_name,
        cart_items_count: context.cart.length,
        cart_total_amount: cartTotal,
        order_state: context.order_state,
        metadata: {
          cart_items: context.cart.map(i => ({ name: i.product_name, qty: i.quantity }))
        }
      });
    
    console.log(`📊 Analytics: User ${action} vendor change`);
  } catch (error) {
    console.error('📊 Analytics error:', error);
  }
}

// ==================== AGENTE PRINCIPAL ====================

export async function handleVendorBot(message: string, phone: string, supabase: any, imageUrl?: string): Promise<string> {
  const normalizedPhone = normalizeArgentinePhone(phone);
  console.log("🤖 AI Bot START - Phone:", normalizedPhone, "Message:", message, "ImageUrl:", imageUrl);

  try {
    // 🚨 EMERGENCY CHECK: Verify platform settings before processing
    const platformSettings = await checkPlatformSettings(supabase);
    
    if (platformSettings) {
      // Check if bot is disabled or in emergency mode
      if (!platformSettings.bot_enabled || platformSettings.emergency_mode) {
        console.log(`🚨 Bot disabled or emergency mode active - bot_enabled: ${platformSettings.bot_enabled}, emergency_mode: ${platformSettings.emergency_mode}`);
        
        // Log this occurrence
        await logBotError(
          supabase,
          platformSettings.emergency_mode ? 'EMERGENCY_MODE' : 'BOT_DISABLED',
          `Bot is ${platformSettings.emergency_mode ? 'in emergency mode' : 'disabled'}. Customer message: "${message.substring(0, 100)}"`,
          normalizedPhone
        );
        
        // Handle with fallback
        return await handleEmergencyFallback(platformSettings, normalizedPhone, message, supabase);
      }
    }
    // 🔄 COMANDO DE REINICIO: Detectar palabras clave para limpiar memoria
    const resetCommands = ['reiniciar', 'empezar de nuevo', 'borrar todo', 'limpiar memoria', 'reset', 'comenzar de nuevo', 'nuevo pedido', 'empezar', 'de cero'];
    const normalizedMessage = message.toLowerCase().trim();
    const nowIso = new Date().toISOString();

    if (resetCommands.some(cmd => normalizedMessage.includes(cmd))) {
      console.log('🔄 Reset command detected, clearing user memory...');

      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_bot_message: JSON.stringify({
            phone: normalizedPhone,
            cart: [],
            order_state: 'idle',
            conversation_history: [],
            selected_vendor_id: undefined,
            selected_vendor_name: undefined,
            delivery_address: undefined,
            payment_method: undefined,
            pending_order_id: undefined,
            delivery_type: undefined,
            payment_methods_fetched: false,
            available_payment_methods: [],
            available_vendors_map: [],
            pending_cancellation: undefined,
            confusion_count: 0,
            user_latitude: undefined,
            user_longitude: undefined,
            pending_location_decision: false,
          }),
          last_message_at: nowIso,
          updated_at: nowIso,
        })
        .eq('phone', normalizedPhone);

      if (error) {
        console.error('Error clearing memory:', error);
      }

      return '🔄 Listo, arrancamos desde cero.\n\n¿Qué te gustaría pedir hoy? 😊';
    }

    // Cargar contexto
    const context = await getContext(normalizedPhone, supabase);
    const orderStateBefore = context.order_state || "idle";
    let lastToolUsed: string | null = null;

    // ⏱️ RESET AUTOMÁTICO POR INACTIVIDAD (sin pedido activo)
    // Usamos timestamps del propio contexto (last_interaction_at, last_menu_fetch, last_vendors_fetch)
    // para evitar consultas extra a bot_interaction_logs que daban timestamps desfasados.
    const lastActivityCandidates = [
      context.last_interaction_at,
      context.last_menu_fetch,
      context.last_vendors_fetch,
    ].filter(Boolean) as string[];
    
    const lastActivityRaw = lastActivityCandidates.length > 0
      ? lastActivityCandidates.reduce((a, b) => (a > b ? a : b))
      : null;
    
    const inactivityLimitMs = 2 * 60 * 60 * 1000; // 2 horas (antes era 10 min, causaba resets falsos)
    const hasLastActivity = !!lastActivityRaw;
    const inactiveMs = hasLastActivity ? Date.now() - new Date(lastActivityRaw!).getTime() : 0;
    const hasActiveOrder = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'].includes(context.order_state || '') && !!context.pending_order_id;
    const hasStaleSessionData = context.order_state !== 'idle' || context.cart.length > 0 || !!context.selected_vendor_id || context.conversation_history.length > 0;

    if (hasLastActivity && inactiveMs > inactivityLimitMs && !hasActiveOrder && hasStaleSessionData) {
      console.log(`⏱️ Inactivity reset: ${Math.round(inactiveMs / 60000)} min without active order`);

      context.order_state = 'idle';
      context.pending_order_id = undefined;
      context.cart = [];
      context.selected_vendor_id = undefined;
      context.selected_vendor_name = undefined;
      context.payment_method = undefined;
      context.delivery_address = undefined;
      context.delivery_type = undefined;
      context.resumen_mostrado = false;
      context.payment_methods_fetched = false;
      context.available_payment_methods = [];
      context.available_vendors_map = [];
      context.pending_cancellation = undefined;
      context.pending_vendor_change = undefined;
      context.confusion_count = 0;
      context.conversation_history = [];
      await saveContext(context, supabase);

      const isSimpleGreeting = /^(hola|holi|buenas?|buen\s*d[ií]a|buen[oa]s?\s+(d[ií]as|tardes|noches)|hey)$/i.test(normalizedMessage);
      if (isSimpleGreeting) {
        return '¡Hola! Retomamos desde cero 😊\n\n¿Qué te gustaría pedir hoy?';
      }
    }
    
    // ✅ Actualizar timestamp de última interacción
    context.last_interaction_at = new Date().toISOString();

    // 🔄 VALIDACIÓN DE SINCRONIZACIÓN: Verificar si pending_order_id ya fue cancelado/entregado
    if (context.pending_order_id) {
      console.log(`🔄 Checking sync status for pending_order_id: ${context.pending_order_id}`);
      const { data: orderCheck } = await supabase
        .from("orders")
        .select("status")
        .eq("id", context.pending_order_id)
        .single();
      
      // Si el pedido no existe o ya fue cancelado/entregado, limpiar contexto
      if (!orderCheck || ['cancelled', 'delivered'].includes(orderCheck.status)) {
        console.log(`🔄 Detected stale order state - order is ${orderCheck?.status || 'not found'}, cleaning context`);
        context.order_state = "idle";
        context.pending_order_id = undefined;
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.delivery_type = undefined;
        context.resumen_mostrado = false;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.conversation_history = [];
        await saveContext(context, supabase);
        console.log(`🧹 Stale context cleaned successfully`);
      }
    }
    
    // ⚠️ VALIDACIÓN AUTOMÁTICA: Limpiar payment_method si es inválido
    if (context.payment_method && 
        context.available_payment_methods?.length > 0 &&
        !context.available_payment_methods.includes(context.payment_method)) {
      
      console.warn(`⚠️ INCONSISTENCY DETECTED: payment_method="${context.payment_method}" is NOT in available_payment_methods=[${context.available_payment_methods.join(',')}]`);
      console.warn(`   Auto-cleaning invalid payment method from context`);
      
      context.payment_method = undefined;
      await saveContext(context, supabase);
      
      console.log(`✅ Invalid payment method cleared successfully`);
    }
    
    // 💳 Log payment validation state
    if (context.payment_method || context.available_payment_methods) {
      console.log(`💳 Payment validation: method=${context.payment_method || 'none'}, available=[${context.available_payment_methods?.join(',') || 'none'}]`);
    }
    
    // 🧹 LIMPIAR CONTEXTO si hay un pedido ACTIVO del mismo vendor O si el vendor ya no existe
    // SOLO limpiamos si el usuario está en estados seguros (idle/order_placed)
    // NO limpiamos si está en medio de un flujo activo
    if (context.selected_vendor_id || context.cart.length > 0) {
      console.log('🔍 Validating context data...');
      console.log(`   Current vendor: ${context.selected_vendor_id} (${context.selected_vendor_name})`);
      console.log(`   Cart items: ${context.cart.length}`);
      console.log(`   Order state: ${context.order_state}`);
      console.log(`   Pending order: ${context.pending_order_id}`);
      let shouldClearContext = false;
      
      // Verificar si hay pedidos ACTIVOS del mismo vendor en las últimas 24h
      // SOLO limpiamos si el usuario está comenzando un nuevo flujo (idle/order_completed/order_cancelled)
      // NO limpiamos si está en medio de hacer un pedido
      const safeStates = ['idle', 'order_completed', 'order_cancelled'];
      const isInSafeState = !context.order_state || safeStates.includes(context.order_state);
      
      if (context.selected_vendor_id && isInSafeState) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: activeOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, status, created_at, vendor_id')
          .eq('customer_phone', normalizedPhone)
          .eq('vendor_id', context.selected_vendor_id)
          .in('status', ['pending', 'preparing', 'ready', 'in_transit'])  // Solo pedidos activos
          .gte('created_at', twentyFourHoursAgo)  // Solo últimas 24h
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (ordersError) {
          console.error('❌ Error checking active orders:', ordersError);
        }
        
        if (activeOrders && activeOrders.length > 0) {
          const activeOrder = activeOrders[0];
          
          // ⭐ EXCEPCIÓN: Si es el pedido que estamos procesando, NO limpiar
          if (activeOrder.id !== context.pending_order_id) {
            console.log(`⚠️ Found active order from same vendor: ${activeOrder.id} (${activeOrder.status})`);
            console.log(`   Created: ${activeOrder.created_at}`);
            console.log(`   This indicates a duplicate order attempt`);
            shouldClearContext = true;
          } else {
            console.log(`✅ Active order found but it's the current pending order - OK`);
          }
        } else {
          console.log(`✅ No active orders found - OK to continue`);
        }
      } else if (context.selected_vendor_id && !isInSafeState) {
        console.log(`⏭️ Skipping active order check - user is in active flow (${context.order_state})`);
      }
      
      // Verificar si el vendor del contexto todavía existe y está activo
      if (context.selected_vendor_id && !shouldClearContext) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, name, is_active, payment_status')
          .eq('id', context.selected_vendor_id)
          .maybeSingle();
        
        if (!vendor || !vendor.is_active || vendor.payment_status !== 'active') {
          console.log(`⚠️ Vendor in context no longer exists or is inactive: ${context.selected_vendor_id}`);
          shouldClearContext = true;
        }
      }
      
      // Limpiar contexto si es necesario
      if (shouldClearContext) {
        console.log('🧹 ========== CLEARING CONTEXT ==========');
        console.log(`   Reason: Found duplicate active order`);
        console.log(`   Current state: ${context.order_state}`);
        console.log(`   Vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);
        console.log(`   Cart items: ${context.cart.length}`);
        console.log('========================================');
        
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.pending_order_id = undefined;
        context.order_state = 'idle';
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.delivery_type = undefined;  // ⭐ Limpiar tipo de entrega
        context.vendor_allows_pickup = undefined;  // ⭐ Limpiar info de pickup
        context.pickup_instructions = undefined;  // ⭐ Limpiar instrucciones
        context.conversation_history = []; // 🧹 Limpiar historial en reset completo
        console.log(`🧹 Full context reset including conversation history and pickup info`);
        
        await saveContext(context, supabase);
        console.log('✅ Context cleared - user can start fresh');
      }
    }
    
    // 📄 MANEJO ESPECIAL: Comprobante recibido
    if (message === 'comprobante_recibido' && imageUrl && context.pending_order_id) {
      console.log('💳 Processing payment receipt for order:', context.pending_order_id);
      
      // Actualizar la orden con el payment_receipt_url
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          payment_receipt_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', context.pending_order_id);
      
      if (updateError) {
        console.error('Error updating order with receipt:', updateError);
        return '❌ Hubo un problema al procesar tu comprobante. Por favor, intenta enviarlo de nuevo o contactá con el negocio.';
      }
      
      // ✅ NO limpiar pending_order_id - mantenerlo para consultas de estado
      // Solo se limpiará cuando el pedido se entregue, cancele o inicie uno nuevo
      context.payment_receipt_url = imageUrl;
      await saveContext(context, supabase);
      
      return `✅ ¡Perfecto! Recibí tu comprobante de pago. 📄\n\nEl negocio lo revisará y confirmará tu pedido pronto.\n\nPodés seguir el estado de tu pedido en cualquier momento. 😊\n\n¿Necesitás algo más?`;
    }
    console.log("📋 Context loaded:", {
      phone: context.phone,
      cartItems: context.cart.length,
      cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "empty",
      vendor: context.selected_vendor_name,
      vendorId: context.selected_vendor_id,
      historyLength: context.conversation_history.length,
      hasLocation: !!(context.user_latitude && context.user_longitude),
    });

    // 🚫 VALIDACIÓN TEMPRANA: Bloquear pedidos duplicados cuando hay uno activo
    const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
    const newOrderKeywords = ['quiero pedir', 'quiero hacer un pedido', 'nuevo pedido', 'hacer pedido', 'quiero comprar', 'ver locales', 'ver negocios', 'ver menu', 'ver menú'];
    const cancelKeywords = ['cancelar pedido', 'cancelar mi pedido', 'cancelar el pedido', 'quiero cancelar', 'cancela mi pedido', 'cancela el pedido'];
    const statusKeywords = ['estado', 'como va', 'cómo va', 'donde viene', 'dónde viene', 'mi pedido', 'pedido'];
    const vendorChatKeywords = ['hablar con vendedor', 'hablar con negocio', 'hablar con local', 'contactar negocio', 'contactar vendedor'];

    if (pendingStates.includes(context.order_state || '')) {
      const messageLower = message.toLowerCase().trim();

      // 🔴 INTERCEPTOR: Si el usuario quiere cancelar, activar flujo programático directamente
      const wantsCancel = cancelKeywords.some(kw => messageLower.includes(kw));
      if (wantsCancel && !context.pending_cancellation) {
        console.log(`🔴 CANCEL INTERCEPT: User wants to cancel, activating programmatic flow`);
        context.pending_cancellation = {
          step: "awaiting_reason",
          order_id: context.pending_order_id || context.last_order_id,
        };
        await saveContext(context, supabase);
        return "¿Por qué querés cancelar el pedido? Escribí el motivo:";
      }

      // 📦 INTERCEPTOR: Consulta de estado sin pasar por LLM
      const wantsStatus = statusKeywords.some(kw => messageLower.includes(kw));
      if (wantsStatus) {
        console.log(`📦 STATUS INTERCEPT: returning order status deterministically`);
        const statusResult = await ejecutarHerramienta("ver_estado_pedido", {}, context, supabase);
        context.conversation_history.push({ role: "assistant", content: statusResult });
        await saveContext(context, supabase);
        return statusResult;
      }

      // 🗣️ INTERCEPTOR: Contacto con negocio sin pasar por LLM
      const wantsVendorChat = vendorChatKeywords.some(kw => messageLower.includes(kw));
      if (wantsVendorChat) {
        console.log(`🗣️ VENDOR CHAT INTERCEPT: opening vendor chat deterministically`);
        const chatResult = await ejecutarHerramienta("hablar_con_vendedor", {}, context, supabase);
        context.conversation_history.push({ role: "assistant", content: chatResult });
        await saveContext(context, supabase);
        return chatResult;
      }

      const wantsNewOrder = newOrderKeywords.some(kw => messageLower.includes(kw));
      if (wantsNewOrder && !context.pending_cancellation) {
        console.log(`🚫 BLOCKED: User tried to start new order with active order in state: ${context.order_state}`);
        const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
        const stateDisplay = context.order_state?.replace('order_pending_', '').replace('_', ' ').toUpperCase() || 'ACTIVO';

        return `⏳ Ya tenés un pedido activo (#${orderId}) en estado *${stateDisplay}*.\n\n📊 Podés:\n- Decir "estado de mi pedido" para ver cómo va\n- Decir "cancelar pedido" si querés cancelarlo\n\nUna vez completado o cancelado, podés hacer un nuevo pedido. 😊`;
      }

      // 🧭 FALLBACK determinista en estados con pedido activo (evita delirios del LLM)
      const isHelpRequest = /^(ayuda|help|menu|opciones|\?|info)/i.test(messageLower);
      if (!isHelpRequest && context.order_state !== 'order_pending_transfer' && !context.pending_cancellation) {
        const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
        return `⏳ Tenés un pedido activo (#${orderId}).\n\nPuedo ayudarte con:\n- "estado de mi pedido"\n- "cancelar pedido"\n- "hablar con vendedor"`;
      }
    }

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({
      role: "user",
      content: message,
    });

    // 🔄 MANEJO ESPECIAL: Confirmación de cambio de negocio
    // Si hay un pending_vendor_change, el usuario debe confirmar sí/no
    if (context.pending_vendor_change) {
      const userResponse = message.toLowerCase().trim();
      
      // ✅ Usuario confirma el cambio
      if (userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|cambio)/)) {
        console.log(`✅ User confirmed vendor change`);
        context.confusion_count = 0;
        
        // Registrar analytics
        await trackVendorChange(context, 'confirmed', supabase);
        
        // Aplicar cambio
        context.cart = [];
        context.selected_vendor_id = context.pending_vendor_change.new_vendor_id;
        context.selected_vendor_name = context.pending_vendor_change.new_vendor_name;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.payment_methods_fetched = false; // ⭐ Resetear métodos de pago
        context.available_payment_methods = []; // ⭐ Limpiar lista de métodos
        context.pending_vendor_change = undefined;
        context.order_state = "browsing"; // ✅ Volver a browsing, no shopping
        context.conversation_history = []; // 🧹 Limpiar historial al cambiar vendor
        console.log(`🧹 Cleared conversation history on vendor change`);
        
        await saveContext(context, supabase);
        
        // ✅ Mensaje mejorado
        const response = `✅ Perfecto, carrito vaciado.\n\n` +
                         `Ahora estás viendo el menú de *${context.selected_vendor_name}*.\n\n` +
                         `¿Qué querés pedir? 🍕`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // ❌ Usuario rechaza el cambio
      if (userResponse.match(/^(no|nop|cancel|cancela)/)) {
        console.log(`❌ User rejected vendor change`);
        context.confusion_count = 0;
        
        // Registrar analytics
        await trackVendorChange(context, 'cancelled', supabase);
        
        // Mantener todo igual
        context.pending_vendor_change = undefined;
        await saveContext(context, supabase);
        
        const response = `Ok, seguimos con ${context.selected_vendor_name}. ¿Qué más querés agregar al pedido?`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // Si la respuesta no es clara, contar intentos
      context.confusion_count = (context.confusion_count || 0) + 1;
      if (context.confusion_count >= 2) {
        // El usuario ignoró la pregunta 2 veces, cancelar cambio pendiente
        console.log(`⏰ pending_vendor_change timeout after ${context.confusion_count} unclear responses, clearing`);
        context.pending_vendor_change = undefined;
        context.confusion_count = 0;
        await saveContext(context, supabase);
        // NO retornar — dejar que el mensaje fluya al resto del flujo
      } else {
        const clarificationResponse = `Por favor confirmá si querés cambiar de negocio.\n\nRespondé *"sí"* para cambiar a ${context.pending_vendor_change.new_vendor_name} o *"no"* para seguir con ${context.selected_vendor_name}.`;
        context.conversation_history.push({
          role: "assistant",
          content: clarificationResponse,
        });
        await saveContext(context, supabase);
        return clarificationResponse;
      }
    }

    // 🔄 MANEJO PROGRAMATICO: Flujo de cancelación con captura de motivo
    if (context.pending_cancellation) {
      const userResponse = message.trim();
      const userResponseLower = userResponse.toLowerCase();
      
      if (context.pending_cancellation.step === "awaiting_reason") {
        // Capturar lo que sea que el usuario escriba como motivo
        console.log(`📝 CANCELLATION: Captured reason: "${userResponse}"`);
        
        const orderId = context.pending_cancellation.order_id || context.pending_order_id || context.last_order_id;
        const orderShort = orderId ? orderId.substring(0, 8) : '???';
        
        context.pending_cancellation = {
          step: "awaiting_confirmation",
          reason: userResponse,
          order_id: orderId,
        };
        await saveContext(context, supabase);
        
        const response = `Vas a cancelar el pedido #${orderShort}.\n📝 Motivo: "${userResponse}"\n\n¿Confirmás la cancelación? (sí/no)`;
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      if (context.pending_cancellation.step === "awaiting_confirmation") {
        const isConfirm = /^(s[ií]|si|yes|dale|ok|confirmo|confirmar|vamos)$/i.test(userResponseLower);
        const isDeny = /^(no|nop|nel|cancelar cancelacion|mejor no|dejá|deja)$/i.test(userResponseLower);
        
        if (isConfirm) {
          console.log(`✅ CANCELLATION: User confirmed, executing cancelar_pedido`);
          const result = await ejecutarHerramienta("cancelar_pedido", {
            motivo: context.pending_cancellation.reason,
            order_id: context.pending_cancellation.order_id,
          }, context, supabase);
          
          context.pending_cancellation = undefined;
          await saveContext(context, supabase);
          return result;
        }
        
        if (isDeny) {
          console.log(`❌ CANCELLATION: User cancelled the cancellation`);
          context.pending_cancellation = undefined;
          await saveContext(context, supabase);
          
          const response = "Ok, no se cancela el pedido. ¿Necesitás algo más? 😊";
          context.conversation_history.push({ role: "assistant", content: response });
          await saveContext(context, supabase);
          return response;
        }
        
        // Respuesta no clara, volver a preguntar
        const clarification = `Respondé *"sí"* para confirmar la cancelación o *"no"* para mantener el pedido.`;
        context.conversation_history.push({ role: "assistant", content: clarification });
        await saveContext(context, supabase);
        return clarification;
      }
    }

    // 🔴 INTERCEPTOR: Cancelar carrito/vaciar en shopping state (no order_pending)
    if (context.order_state === "shopping") {
      const msgLower = message.toLowerCase().trim();
      const wantsCancelShopping = /cancelar|vaciar carrito|no quiero|quiero cancelar/.test(msgLower);
      if (wantsCancelShopping) {
        console.log(`🔴 CANCEL SHOPPING: User wants to cancel/empty cart in shopping state`);
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.order_state = "idle";
        context.delivery_type = undefined;
        context.delivery_address = undefined;
        context.payment_method = undefined;
        context.conversation_history = [];
        await saveContext(context, supabase);
        return `✅ Carrito vaciado.\n\n¿Qué querés hacer? Puedo mostrarte negocios abiertos o buscar algo puntual 😊`;
      }
    }

    // 🏪 INTERCEPTOR: "Quiero pedir de [negocio]" o "cambiar de negocio" en shopping state
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      const msgLower = message.toLowerCase().trim();
      
      // Detect "quiero pedir de X", "cambiar de negocio", "pedir de X"
      const vendorSwitchMatch = msgLower.match(/(?:quiero pedir de|pedir de|cambiar (?:a|de) negocio|cambiar de local|ir a)\s+(.+)/i);
      const wantsSwitch = /cambiar de negocio|cambiar de local|otro negocio|otro local/.test(msgLower);
      
      if (vendorSwitchMatch || wantsSwitch) {
        console.log(`🏪 VENDOR SWITCH INTERCEPTOR in shopping state`);
        
        if (context.cart.length > 0) {
          // Has items - need to confirm
          const vendorName = vendorSwitchMatch ? vendorSwitchMatch[1].trim() : null;
          
          if (vendorName) {
            // Try to find the vendor
            const { data: foundVendor } = await supabase
              .from("vendors")
              .select("id, name")
              .ilike("name", `%${vendorName}%`)
              .eq("is_active", true)
              .maybeSingle();
            
            if (foundVendor) {
              context.pending_vendor_change = {
                new_vendor_id: foundVendor.id,
                new_vendor_name: foundVendor.name
              };
              await saveContext(context, supabase);
              
              return `⚠️ Tenés productos en el carrito de *${context.selected_vendor_name}*.\n\n` +
                     `Si cambias a *${foundVendor.name}*, se vaciará el carrito.\n\n` +
                     `¿Querés cambiar? (sí/no)`;
            }
          }
          
          // Generic switch request with cart
          return `⚠️ Tenés productos en el carrito de *${context.selected_vendor_name}*.\n\n` +
                 `Si querés cambiar de negocio, primero vaciá el carrito diciendo "vaciar carrito".\n\n` +
                 `O decime "cancelar" para empezar de nuevo.`;
        } else {
          // Empty cart - switch directly
          context.order_state = "idle";
          context.selected_vendor_id = undefined;
          context.selected_vendor_name = undefined;
          context.conversation_history = [];
          await saveContext(context, supabase);
          
          const vendorName = vendorSwitchMatch ? vendorSwitchMatch[1].trim() : null;
          if (vendorName) {
            // Search for the vendor
            const result = await ejecutarHerramienta("buscar_productos", {
              consulta: vendorName,
            }, context, supabase);
            context.conversation_history.push({ role: "assistant", content: result });
            await saveContext(context, supabase);
            return result;
          }
          
          return `✅ ¡Dale! ¿De qué negocio querés pedir?\n\nDecí "ver negocios" o buscá un producto. 😊`;
        }
      }
    }

    // 🍕 INTERCEPTOR: Product request in shopping state that doesn't match current vendor
    // E.g., user is in "Heladería Italiana" but says "quiero una hamburguesa"
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      const msgLower = message.toLowerCase().trim();
      const productRequest = msgLower.match(/^(?:quiero|dame|me gusta[rí]a|quisiera|necesito)\s+(?:un[ao]?\s+)?(.+)/i);
      
      if (productRequest) {
        const requestedProduct = productRequest[1].trim();
        
        // Check if this product exists in the current vendor's menu
        const { data: matchingProducts } = await supabase
          .from("products")
          .select("id, name")
          .eq("vendor_id", context.selected_vendor_id)
          .eq("is_available", true)
          .ilike("name", `%${requestedProduct.split(/\s+/).filter(w => w.length > 2)[0] || requestedProduct}%`);
        
        if (!matchingProducts || matchingProducts.length === 0) {
          // Product NOT in current vendor - check if it mentions another vendor
          const mentionsVendor = msgLower.match(/(?:de|del)\s+(.+?)$/i);
          
          if (mentionsVendor) {
            const vendorSearch = mentionsVendor[1].trim();
            const { data: foundVendor } = await supabase
              .from("vendors")
              .select("id, name")
              .ilike("name", `%${vendorSearch}%`)
              .eq("is_active", true)
              .maybeSingle();
            
            if (foundVendor && foundVendor.id !== context.selected_vendor_id) {
              // User wants product from a different vendor
              if (context.cart.length > 0) {
                context.pending_vendor_change = {
                  new_vendor_id: foundVendor.id,
                  new_vendor_name: foundVendor.name
                };
                await saveContext(context, supabase);
                return `⚠️ Estás en *${context.selected_vendor_name}* y tenés ${context.cart.length} producto(s) en el carrito.\n\n` +
                       `¿Querés cambiar a *${foundVendor.name}*? Se vaciará tu carrito actual. (sí/no)`;
              } else {
                // Empty cart, switch directly
                context.order_state = "browsing";
                context.selected_vendor_id = undefined;
                context.selected_vendor_name = undefined;
                context.conversation_history = [];
                await saveContext(context, supabase);
                
                const result = await ejecutarHerramienta("ver_menu_negocio", {
                  vendor_id: foundVendor.id,
                }, context, supabase);
                context.conversation_history.push({ role: "assistant", content: result });
                await saveContext(context, supabase);
                return result;
              }
            }
          }
          
          // Product not found in current vendor and no vendor mention
          // Don't intercept - let it fall through to shopping interceptor / LLM
          // But if it's clearly a food item not in the menu, suggest searching
          const foodKeywords = /\b(pizza|hamburguesa|empanada|milanesa|sushi|cerveza|pollo|asado|lomito|sandwich|tarta|torta|ensalada|papas|medialunas?|facturas?|ravioles?|ñoquis?|pastas?)\b/i;
          if (foodKeywords.test(requestedProduct)) {
            console.log(`🍕 Product "${requestedProduct}" not found in ${context.selected_vendor_name}, suggesting search`);
            return `No encontré "${requestedProduct}" en el menú de *${context.selected_vendor_name}*.\n\n` +
                   `¿Querés que busque negocios que tengan "${requestedProduct}"? Decí *"buscar ${requestedProduct}"*\n` +
                   `O decí *"menú"* para ver los productos disponibles acá.`;
          }
        }
        // If product IS in current vendor, let shopping interceptor handle it
      }
    }

    // 🔍 INTERCEPTOR: "buscar X" or "ver locales/negocios" in shopping state with empty cart
    if (context.order_state === "shopping" && context.cart.length === 0) {
      const msgLower = message.toLowerCase().trim();
      
      // "buscar hamburguesa", "donde puedo pedir hamburguesa"
      const searchMatch = msgLower.match(/^(?:buscar|busco|donde puedo pedir|dónde puedo pedir|quiero buscar)\s+(.+)/i);
      const wantsList = /^(ver locales|ver negocios|locales abiertos|negocios abiertos|ver la lista|lista de locales|quiero la lista)/i.test(msgLower);
      const wantsOrder = /^(quiero (?:hacer )?(?:un )?pedido|hacer (?:un )?pedido|me gustaria pedir|me gustaría pedir comida)/i.test(msgLower);
      
      if (searchMatch || wantsList || wantsOrder) {
        // Reset to idle first since cart is empty
        context.order_state = "idle";
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.conversation_history = [];
        await saveContext(context, supabase);
        
        if (searchMatch) {
          const result = await ejecutarHerramienta("buscar_productos", {
            consulta: searchMatch[1].trim(),
          }, context, supabase);
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
        
        if (wantsList || wantsOrder) {
          const result = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }
    }

    // 🎯 INTERCEPTOR: Confirmación sí/no cuando el negocio solo permite un tipo de entrega
    if (context.awaiting_delivery_mode_confirmation && context.selected_vendor_id) {
      const normalizedReply = normalizeIntentText(message);
      const confirms = /^(s[i]+|yes+|ok(?:ay)?|dale|listo|va(?:mos)?|claro|obvio|confirmo|de una|si quiero)$/.test(normalizedReply);
      const rejects = /^(no|nop|nope|cancel(?:ar|a)?|mejor no)$/.test(normalizedReply);

      if (confirms) {
        const forcedType = context.awaiting_delivery_mode_confirmation;
        context.awaiting_delivery_mode_confirmation = undefined;
        context.delivery_type = forcedType;

        let response: string;
        if (forcedType === "delivery") {
          context.order_state = "needs_address";
          response = "✅ Perfecto, seguimos con *envío a domicilio*.\n\n📍 ¿Cuál es tu dirección de entrega?";
        } else {
          context.order_state = "checkout";
          context.delivery_address = undefined; // Pickup: limpiar dirección residual
          const vendorConfig = await getVendorConfig(context.selected_vendor_id, supabase);
          const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
          response = `✅ Perfecto, seguimos con *retiro en local*.\n\n📍 Retirá en: ${vendorConfig.address || context.selected_vendor_name || "el local"}\n\n${paymentResult}`;
        }

        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }

      if (rejects) {
        context.awaiting_delivery_mode_confirmation = undefined;
        const response = "Entendido 👍 ¿Querés seguir comprando, cambiar de negocio o cancelar el pedido?";
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }

      const reminder = context.awaiting_delivery_mode_confirmation === "delivery"
        ? "Este negocio trabaja solo con *delivery*. ¿Seguimos con envío a domicilio? Respondé \"sí\" o \"no\"."
        : "Este negocio trabaja solo con *retiro en local*. ¿Seguimos con retiro? Respondé \"sí\" o \"no\".";

      context.conversation_history.push({ role: "assistant", content: reminder });
      await saveContext(context, supabase);
      return reminder;
    }

    // 🔍 INTERCEPTOR PAGO: Si ya se mostraron métodos de pago y falta elegir, capturar selección ANTES del shopping
    // Esto evita que "1" se interprete como producto cuando debería ser método de pago
    if (context.payment_methods_fetched && !context.payment_method && 
        (context.delivery_address || context.delivery_type === 'pickup')) {
      console.log(`🔍 [PAYMENT INTERCEPTOR] Checking payment selection. Message: ${message}`);
      console.log(`📋 Available methods: ${context.available_payment_methods?.join(', ')}`);
      
      const normalizedMsg = message.toLowerCase().trim();
      let selectedMethod: string | null = null;
      
      // 🔴 v5: Detectar negaciones puras ("no efectivo", "no transferencia") → NO seleccionar
      const negationOnly = /^\s*no\s+(efectivo|transferencia|mercado\s*pago|mp|cash)\s*[.!?]*$/i.test(normalizedMsg);
      if (negationOnly) {
        console.log(`🔴 Negation detected: "${normalizedMsg}" — NOT selecting any method`);
        const availableList = context.available_payment_methods?.map((m, i) => `${i+1}️⃣ ${m.charAt(0).toUpperCase() + m.slice(1)}`).join('\n') || '';
        const negResponse = `Entendido 👍 Entonces, ¿con cuál preferís pagar?\n\n${availableList}`;
        context.conversation_history.push({ role: "assistant", content: negResponse });
        await saveContext(context, supabase);
        return negResponse;
      }
      
      // Detectar números "1", "2", "3"
      if (/^[123]$/.test(normalizedMsg) && context.available_payment_methods && context.available_payment_methods.length > 0) {
        const index = parseInt(normalizedMsg) - 1;
        if (index >= 0 && index < context.available_payment_methods.length) {
          selectedMethod = context.available_payment_methods[index];
          console.log(`✅ Numeric selection: "${normalizedMsg}" → "${selectedMethod}"`);
        }
      }
      
      // Detectar método por texto — usando normalizePaymentInput + cruzar con available
      if (!selectedMethod) {
        const detected = normalizePaymentInput(normalizedMsg);
        if (detected) {
          const available = context.available_payment_methods || [];
          if (available.some(m => m.toLowerCase().includes(detected))) {
            selectedMethod = detected;
            console.log(`✅ Text detection: "${normalizedMsg}" → "${selectedMethod}" (validated vs available)`);
          } else {
            console.log(`⚠️ Detected "${detected}" but NOT in available methods: [${available.join(', ')}]`);
          }
        }
      }
      
      // Si confirma con "Sí/Dale" y hay UN solo método, auto-seleccionar
      if (!selectedMethod) {
        const confirmKeywords = /^(s[ií]|si|yes|dale|ok|confirmo|listo|confirmar)$/i;
        if (confirmKeywords.test(normalizedMsg) && context.available_payment_methods?.length === 1) {
          selectedMethod = context.available_payment_methods[0];
          console.log(`✅ Auto-selected single method: ${selectedMethod}`);
        }
      }
      
      if (selectedMethod) {
        // Validar que está disponible
        if (!context.available_payment_methods || !context.available_payment_methods.includes(selectedMethod)) {
          const availableList = context.available_payment_methods?.map(m => `- ${m}`).join('\n') || '- (ninguno disponible)';
          const errorResponse = `⚠️ El método "${selectedMethod}" no está disponible en ${context.selected_vendor_name}.\n\nPor favor elegí uno de estos:\n${availableList}`;
          context.conversation_history.push({ role: "assistant", content: errorResponse });
          await saveContext(context, supabase);
          return errorResponse;
        }
        
        // Guardar método y mostrar resumen (NO crear pedido directo)
        console.log(`✅ Valid payment method: ${selectedMethod}. Showing summary for confirmation.`);
        context.payment_method = selectedMethod;
        context.order_state = 'checkout';
        await saveContext(context, supabase);
        
        const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
        
        context.conversation_history.push({ role: "assistant", content: resumenResult });
        await saveContext(context, supabase);
        return resumenResult;
      }
    }

    // 🛒 INTERCEPTOR: Estado shopping + número/producto → agregar al carrito directamente
    // SOLO interceptar cuando hay intención de compra clara (número, "dame X", "quiero X")
    // Todo lo demás (confirmaciones, saludos, preguntas) fluye al LLM
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      // Guard: si estamos esperando selección de pago, NO interceptar números como productos
      const isWaitingPayment = context.payment_methods_fetched && !context.payment_method;
      const isPurchaseOrNumber = looksLikePurchaseIntent(message) || /^\d+$/.test(message.trim());
      if (isPurchaseOrNumber && !isWaitingPayment) {
        const shoppingResult = await handleShoppingInterceptor(message, context, supabase);
        if (shoppingResult) {
          context.conversation_history.push({ role: "assistant", content: shoppingResult });
          await saveContext(context, supabase);
          return shoppingResult;
        }
      }
      // "Siii", "lo confirmo", "carrito", "menú", etc. → fluye al LLM con herramientas de shopping
    }


    // Cuando resumen_mostrado = true y el usuario confirma, llamar crear_pedido
    // directamente sin pasar por el LLM (que alucina "pedido activo" inexistente)
    if (context.resumen_mostrado && !context.pending_order_id) {
      const userResponse = message.toLowerCase().trim();
      const isConfirmation = /^(s[ií]|si|yes|dale|ok|confirmo|listo|confirmar|vamos|va|claro|obvio|seguro|por supuesto|manda|dale que si)\b/i.test(userResponse);
      const isCancellation = /^(no\b|nop|cancel|cancela|cambiar)/i.test(userResponse);
      
      // v3/v4: Detectar doble intención — usuario modifica el pedido en review → volver a cart
      const wantsModification = CART_MODIFICATION_REGEX.test(userResponse) || 
        /\b(mejor|prefiero|cambi[aá]r?|reemplaz[aá]r?)\b/i.test(userResponse);
      
      if (wantsModification) {
        console.log(`🔄 MODIFICATION in review detected: "${userResponse}" → back to shopping`);
        context.resumen_mostrado = false;
        context.order_state = 'shopping';
        await saveContext(context, supabase);
        // Let LLM handle the modification request with shopping tools
      } else if (isConfirmation) {
        // v5: Block confirmation if missing structural data
        if (!context.delivery_type) {
          const retryResponse = "⚠️ Falta elegir el tipo de entrega (delivery o retiro). ¿Cómo lo querés?";
          context.conversation_history.push({ role: "assistant", content: retryResponse });
          await saveContext(context, supabase);
          return retryResponse;
        }
        if (context.delivery_type === 'delivery' && !context.delivery_address) {
          const retryResponse = "⚠️ Falta tu dirección de entrega. ¿A dónde te lo mando? 📍";
          context.conversation_history.push({ role: "assistant", content: retryResponse });
          await saveContext(context, supabase);
          return retryResponse;
        }
        if (!context.payment_method) {
          const retryResponse = "⚠️ Falta elegir el método de pago. ¿Cómo querés pagar?";
          context.conversation_history.push({ role: "assistant", content: retryResponse });
          await saveContext(context, supabase);
          return retryResponse;
        }
        
        console.log(`✅ PROGRAMMATIC: User confirmed order post-summary, calling crear_pedido directly`);
        const result = await ejecutarHerramienta("crear_pedido", {
          direccion: context.delivery_address,
          metodo_pago: context.payment_method,
        }, context, supabase);
        
        await saveContext(context, supabase);
        return result;
      }
      
      if (isCancellation) {
        console.log(`❌ PROGRAMMATIC: User cancelled post-summary, resetting resumen_mostrado`);
        context.resumen_mostrado = false;
        context.awaiting_delivery_mode_confirmation = undefined;
        await saveContext(context, supabase);
        // Dejar que el LLM maneje la cancelacion/modificacion
      }
    }

    // 🔄 MANEJO ESPECIAL: Usuario en order_pending_mp pide el link de pago
    if (context.order_state === "order_pending_mp") {
      const userMessage = message.toLowerCase().trim();
      
      // Si el usuario pide el link de pago
      if (userMessage.match(/link|pag(o|ar|ame)|mercadopago|mp/i)) {
        
        if (!context.pending_order_id) {
          return "❌ No encontré un pedido pendiente. Por favor iniciá un nuevo pedido.";
        }
        
        try {
          console.log("🔗 User requesting payment link for order:", context.pending_order_id);
          
          // Generar link de pago
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
            body: { orderId: context.pending_order_id },
          });
          
          let response = "";
          
          if (paymentError) {
            console.error("❌ Error generating payment link:", paymentError);
            response = `⚠️ Hubo un problema al generar el link de pago.\n\nPor favor contactá al negocio para coordinar el pago.`;
          } else if (paymentData?.success && paymentData?.payment_link) {
            console.log("✅ Payment link generated:", paymentData.payment_link);
            response = `🔗 *Link de pago de MercadoPago:*\n${paymentData.payment_link}\n\n`;
            response += `👆 Tocá el link para completar tu pago de forma segura.\n\n`;
            response += `Una vez que pagues, recibirás la confirmación automáticamente. 😊`;
          } else if (paymentData?.available_methods) {
            response = `⚠️ MercadoPago no está disponible en este momento.\n\n`;
            response += `Métodos de pago alternativos:\n\n`;
            
            for (const method of paymentData.available_methods) {
              if (method.method === 'transferencia') {
                response += `📱 *Transferencia bancaria:*\n`;
                response += `• Alias: ${method.details.alias}\n`;
                response += `• CBU/CVU: ${method.details.cbu}\n`;
                response += `• Titular: ${method.details.titular}\n`;
                response += `• Monto: $${method.details.amount}\n\n`;
              } else if (method.method === 'efectivo') {
                response += `💵 *Efectivo:* ${method.details.message}\n\n`;
              }
            }
          } else {
            response = `⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.`;
          }
          
          context.conversation_history.push({
            role: "assistant",
            content: response,
          });
          await saveContext(context, supabase);
          
          return response;
        } catch (error) {
          console.error("💥 Exception generating payment link:", error);
          return `⚠️ Error al procesar tu solicitud. Por favor intentá de nuevo o contactá al negocio.`;
        }
      }
    }

    // 🔍 VALIDACIÓN: Detectar intentos de confirmar pedido sin tratarlo como producto
    const isConfirming = isOrderConfirmationSignal(message) && !looksLikePurchaseIntent(message);

    if (isConfirming && (context.order_state === 'shopping' || context.order_state === 'checkout')) {
      console.log(`🔍 User attempting to confirm order. Cart items: ${context.cart.length}`);
      console.log(`📋 Cart validation: ${context.cart.length} items in DB`);
      console.log(`🔍 Cart contents: ${context.cart.map(i => `${i.product_name}x${i.quantity}`).join(', ') || 'EMPTY'}`);
      console.log(`📋 resumen_mostrado: ${context.resumen_mostrado}, delivery_type: ${context.delivery_type}, payment_method: ${context.payment_method}`);
      
      if (context.cart.length === 0) {
        console.warn(`⚠️ CRITICAL: User trying to confirm with EMPTY cart!`);
        console.warn(`   This should never happen - cart is empty but user thinks they have products`);
        
        const emptyCartResponse = "⚠️ Tu carrito está vacío. Primero agregá productos del menú de " +
               `${context.selected_vendor_name || 'un negocio'}.\n\n¿Querés que te muestre el menú?`;
        
        context.conversation_history.push({
          role: "assistant",
          content: emptyCartResponse,
        });
        await saveContext(context, supabase);
        
        return emptyCartResponse;
      }
      
      // 🔄 NUEVO: Si el pedido está completo y ya se mostró el resumen, crear pedido directamente
      if (context.resumen_mostrado && context.delivery_type && context.payment_method) {
        console.log(`✅ Order is complete, creating order automatically...`);
        
        const orderResult = await ejecutarHerramienta(
          "crear_pedido",
          {
            direccion: context.delivery_address || '',
            metodo_pago: context.payment_method
          },
          context,
          supabase
        );
        
        context.conversation_history.push({
          role: "assistant",
          content: orderResult,
        });
        await saveContext(context, supabase);
        
        return orderResult;
      }
      
      // 🔄 CHECKOUT: Si está en checkout sin payment_method, auto-seleccionar si hay 1 solo método
      if (context.order_state === 'checkout' && context.delivery_type && !context.payment_method) {
        console.log(`🔍 Checkout confirmation without payment method. Auto-selecting if single method available...`);
        
        // Si no tenemos los métodos cargados, cargarlos
        if (!context.available_payment_methods || context.available_payment_methods.length === 0) {
          await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
        }
        
        if (context.available_payment_methods && context.available_payment_methods.length === 1) {
          const autoMethod = context.available_payment_methods[0];
          console.log(`✅ Auto-selecting single payment method: ${autoMethod}`);
          context.payment_method = autoMethod;
          
          const orderResult = await ejecutarHerramienta(
            "crear_pedido",
            {
              direccion: context.delivery_address || '',
              metodo_pago: autoMethod
            },
            context,
            supabase
          );
          
          context.conversation_history.push({
            role: "assistant",
            content: orderResult,
          });
          await saveContext(context, supabase);
          
          return orderResult;
        }
        
        // Múltiples métodos: mostrar la lista
        const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
        const chooseResponse = `Elegí un método de pago:\n\n${paymentResult}`;
        
        context.conversation_history.push({
          role: "assistant",
          content: chooseResponse,
        });
        await saveContext(context, supabase);
        
        return chooseResponse;
      }
      
      // 🔄 NUEVO: Si tiene delivery_type y payment_method pero no se mostró resumen, mostrarlo
      if (context.delivery_type && context.payment_method && !context.resumen_mostrado) {
        console.log(`📋 Showing summary before creating order...`);
        
        const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
        
        context.conversation_history.push({
          role: "assistant",
          content: resumenResult,
        });
        await saveContext(context, supabase);
        
        return resumenResult;
      }
      
      // Si tiene productos pero no está completo, mostrar carrito y pedir lo que falta
      console.log(`✅ User confirming with ${context.cart.length} items. Forcing ver_carrito to show real cart...`);
      const cartSummary = await ejecutarHerramienta("ver_carrito", {}, context, supabase);
      
      let confirmResponse = cartSummary;
      
      // Agregar lo que falta
      if (!context.delivery_type) {
        let allowsDelivery = true;
        let allowsPickup = false;
        
        if (context.selected_vendor_id) {
          const vendorConfig = await getVendorConfig(context.selected_vendor_id, supabase);
          allowsDelivery = vendorConfig.allows_delivery !== false;
          allowsPickup = vendorConfig.allows_pickup === true;
        }

        if (allowsDelivery && !allowsPickup) {
          context.delivery_type = 'delivery';
          context.order_state = 'needs_address';
          confirmResponse += "\n\n🚚 Este negocio trabaja solo con *delivery*.\n📍 Por favor, escribí tu dirección de entrega (calle y número).";
        } else if (allowsPickup && !allowsDelivery) {
          context.delivery_type = 'pickup';
          context.delivery_address = undefined; // Pickup: limpiar dirección residual
          context.order_state = 'checkout';
          const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
          confirmResponse += `\n\n🏪 Este negocio trabaja solo con *retiro en local*.\n\n${paymentResult}`;
        } else {
          confirmResponse += "\n\n¿Lo retirás en el local o te lo enviamos? 🏪🚚";
        }
      } else if (context.delivery_type === 'delivery' && !context.delivery_address) {
        confirmResponse += "\n\n✍️ Escribí tu dirección de entrega (calle y número)";
      } else if (!context.payment_method) {
        // Mostrar métodos de pago disponibles y transicionar a checkout
        context.order_state = 'checkout';
        const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
        confirmResponse += "\n\n" + paymentResult;
      }
      
      context.conversation_history.push({
        role: "assistant",
        content: confirmResponse,
      });
      await saveContext(context, supabase);
      
      return confirmResponse;
    }

    // ⭐ BUG FIX #3: Detectar si usuario envía dirección pero ya tiene pickup configurado
    if (context.delivery_type === 'pickup' && 
        context.order_state === 'checkout' &&
        !context.payment_method &&
        message.match(/\d{2,}/) &&  // Contiene números (probable dirección)
        !message.match(/^[123]$/)) {  // No es selección de método de pago
      console.log(`⚠️ User sent address-like message but delivery_type is pickup: "${message}"`);
      
      const pickupReminder = `📍 Tu pedido es para *retiro en local*, no necesito dirección de entrega.\n\n` +
                            `Lo vas a retirar en: ${context.selected_vendor_name}\n\n` +
                            `¿Con qué método querés pagar? Respondé con el número o nombre del método.`;
      
      context.conversation_history.push({
        role: "assistant",
        content: pickupReminder,
      });
      await saveContext(context, supabase);
      
      return pickupReminder;
    }

    // 🔄 FALLBACK: Si está en checkout sin payment_methods_fetched, cargar métodos automáticamente
    if (context.order_state === 'checkout' && !context.payment_methods_fetched && 
        context.selected_vendor_id && !context.payment_method) {
      console.log(`🔄 Auto-fetching payment methods for checkout state...`);
      await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
    }

    // (Payment method selection interceptor moved earlier in the flow — before shopping interceptor)

    // 🔄 MANEJO ESPECIAL: Confirmación de transferencia bancaria
    if (context.order_state === "order_pending_transfer") {
      const userResponse = message.toLowerCase().trim();
      
      // 🔄 Ignorar menciones repetidas de "transferencia" - el usuario ya lo eligió
      if (userResponse.match(/transfer/i) && !userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|no|nop|cancel)/)) {
        console.log(`ℹ️ User mentioned "transferencia" again - reminding about confirmation`);
        const reminder = `Ya seleccionaste transferencia bancaria como método de pago. 👍\n\n` +
                        `Solo necesito que *confirmes* si querés continuar con el pedido.\n\n` +
                        `Respondé:\n` +
                        `• *"Sí"* para confirmar el pedido\n` +
                        `• *"No"* para cancelar`;
        
        context.conversation_history.push({
          role: "assistant",
          content: reminder,
        });
        
        return reminder;
      }
      
      // ✅ Usuario confirma la transferencia
      if (userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|listo|perfecto|continua|continuar)/)) {
        console.log(`✅ User confirmed bank transfer payment`);
        
        context.order_state = "order_confirmed";
        await saveContext(context, supabase);
        
        const response = `✅ ¡Perfecto! Tu pedido está confirmado.\n\n` +
                        `📸 Ahora enviame el *comprobante de transferencia* para que el negocio pueda procesar tu pedido.\n\n` +
                        `Podés enviar una foto o captura del comprobante. 📱`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // ❌ Usuario cancela el pedido
      if (userResponse.match(/^(no|nop|cancel|cancela|cancelar)/)) {
        console.log(`❌ User cancelled order during transfer confirmation`);
        
        // Cancelar el pedido si existe
        if (context.pending_order_id) {
          await supabase
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", context.pending_order_id);
        }
        
        context.order_state = "idle";
        context.pending_order_id = undefined;
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.awaiting_delivery_mode_confirmation = undefined;
        context.delivery_address = undefined;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.conversation_history = []; // 🧹 Limpiar historial al cancelar pedido
        console.log(`🧹 Order cancelled, full context reset`);
        await saveContext(context, supabase);
        
        const response = `Pedido cancelado. ¿En qué más puedo ayudarte? 😊`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // Si la respuesta no es clara, recordar que debe confirmar
      const clarificationResponse = `Por favor confirmá si vas a hacer la transferencia bancaria.\n\n` +
                                    `Respondé *"sí"* para confirmar o *"no"* para cancelar el pedido.`;
      
      context.conversation_history.push({
        role: "assistant",
        content: clarificationResponse,
      });
      await saveContext(context, supabase);
      
      return clarificationResponse;
    }

    // 🎯 FASE 2: Interceptores deterministas pre-LLM
    
    // INTERCEPTOR: Estado needs_address - todo lo que no sea cancelar/volver se trata como dirección
    if ((context.order_state === "needs_address" || 
        (context.order_state === "shopping" && context.delivery_type === "delivery" && !context.delivery_address && context.cart.length > 0)) 
        && message.trim().length > 3) {
      const msgLower = message.toLowerCase().trim();
      const notAddress = /^(cancel|volver|cambiar|no\b|menu|carrito|ayuda|estado|hola|confirm|pedido|listo|dale|ok\b|s[ií]\b)/i.test(msgLower);
      
      if (!notAddress) {
        console.log(`📍 INTERCEPTOR: Treating message as address in needs_address state: "${message}"`);
        const result = await ejecutarHerramienta("confirmar_direccion_entrega", {
          direccion: message.trim(),
        }, context, supabase);
        
        context.confusion_count = 0;
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }

    // INTERCEPTOR: Estado idle/browsing → detectar intención de ver negocios/opciones antes de buscar productos
    if ((context.order_state === "idle" || context.order_state === "browsing" || !context.order_state) && !context.selected_vendor_id) {
      const msgLower = message.toLowerCase().trim();

      // Frases que significan "mostrame qué hay" → ver_locales_abiertos
      // IMPORTANT: "qué hay en X" means "show me vendor X menu", NOT "show vendor list"
      // So we exclude "qué hay" when followed by "en/del/de la" (vendor-specific intent)
      const hasVendorSpecificSuffix = /\b(?:que|qué)\s+(?:hay|tienen|tenemos|ofrecen)\s+(?:en|del?|de\s+la)\s+\w/i.test(msgLower);
      const wantsVendorList = !hasVendorSpecificSuffix && /(?:\bver\s+(?:opciones|locales|negocios|tiendas|categor[ií]as?|todo|men[uú])\b|\bopciones\b|\b(?:que|qué)\s+hay\b|\b(?:que|qué)\s+ten[eé]s\b|\b(?:que|qué)\s+puedo\s+pedir\b|\bd[oó]nde\s+puedo\s+pedir\b|\bmostrame\b|\bnegocios\s+abiertos\b|\blocales\s+abiertos\b)/i.test(msgLower);

      if (wantsVendorList) {
        // If there's exactly 1 vendor from a recent search, show its menu directly
        if (context.available_vendors_map && context.available_vendors_map.length === 1) {
          const singleVendor = context.available_vendors_map[0];
          console.log(`🏪 INTERCEPTOR: Single vendor in map "${singleVendor.name}", showing its menu instead of vendor list`);
          const result = await ejecutarHerramienta("ver_menu_negocio", {
            vendor_id: String(singleVendor.index),
          }, context, supabase);
          context.confusion_count = 0;
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
        console.log(`🏪 INTERCEPTOR: User wants to see options/vendors: "${message.trim()}", calling ver_locales_abiertos`);
        const result = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
        context.confusion_count = 0;
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }

      // INTERCEPTOR: Respuestas conversacionales a sugerencias del bot
      // "algo puntual", "algo específico", "buscar algo", "algo en particular", "sí, buscar"
      const wantsToSearch = /^(?:algo\s+(?:puntual|espec[ií]fico|en\s+particular|particular)|buscar\s+algo|s[ií],?\s*buscar|quiero\s+buscar|s[ií],?\s*algo\s+puntual)$/i.test(msgLower);
      if (wantsToSearch) {
        console.log(`🔍 INTERCEPTOR: User wants to search but didn't specify what: "${message.trim()}"`);
        const response = "¡Dale! 😊 Decime qué producto o tipo de producto estás buscando (ej: \"pizza\", \"helado\", \"bebidas\").";
        context.confusion_count = 0;
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }

      // INTERCEPTOR: Preguntas tipo "¿qué hay en el vivero?" → abrir menú de negocio (sin buscar literal producto)
      const vendorIntentMatch = msgLower.match(
        /(?:que|qué)\s+(?:tenemos|hay|tienen|ofrecen)\s+(?:en|del?|de la)\s+(.+)$|(?:ver|mostrar|mostrame)\s+(?:el\s+)?men[uú]\s+(?:de|del|de la)\s+(.+)$|(?:productos?|cat[aá]logo)\s+(?:de|del|de la)\s+(.+)$/i,
      );
      const rawVendorCandidate = vendorIntentMatch?.slice(1).find(Boolean)?.trim();
      if (rawVendorCandidate) {
        const vendorCandidate = rawVendorCandidate
          .replace(/[?!.,;:]+$/g, "")
          .replace(/^(el|la|los|las)\s+/i, "")
          .trim();

        if (vendorCandidate.length >= 3) {
          console.log(`🏪 INTERCEPTOR: Vendor intent detected "${message.trim()}" → "${vendorCandidate}"`);
          const result = await ejecutarHerramienta("ver_menu_negocio", {
            vendor_id: vendorCandidate,
          }, context, supabase);

          if (/^No encontré ese negocio/i.test(result)) {
            const fallbackList = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
            const response = `No identifiqué el negocio "${vendorCandidate}".\n\n${fallbackList}`;
            context.confusion_count = 0;
            context.conversation_history.push({ role: "assistant", content: response });
            await saveContext(context, supabase);
            return response;
          }

          context.confusion_count = 0;
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }

      // INTERCEPTOR: Detectar referencia a un negocio de la lista por nombre parcial
      // Ej: "que tenemos en el vivero?", "vivero", "burger", "pizzeria don luigi"
      if (context.available_vendors_map && context.available_vendors_map.length > 0) {
        const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
        const msgNorm = normalize(msgLower);
        
        const matchedVendor = context.available_vendors_map.find(v => {
          const vendorNorm = normalize(v.name);
          // Check if any word from the vendor name appears in the message (min 4 chars to avoid false positives)
          const vendorWords = vendorNorm.split(/\s+/).filter(w => w.length >= 4);
          return vendorWords.some(word => msgNorm.includes(word));
        });
        
        if (matchedVendor) {
          console.log(`🏪 INTERCEPTOR: Vendor name reference detected: "${message.trim()}" → "${matchedVendor.name}" (#${matchedVendor.index})`);
          const result = await ejecutarHerramienta("ver_menu_negocio", {
            vendor_id: String(matchedVendor.index),
          }, context, supabase);
          context.confusion_count = 0;
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }

      // 🛒 INTERCEPTOR: Intención de compra ("dame X", "quiero X", "X unidades de Y")
      // Si el usuario tiene un vendor reciente en contexto, enrutar a shopping en vez de buscar_productos
      const purchaseIntent = looksLikePurchaseIntent(message);
      
      if (purchaseIntent) {
        // Si hay vendor seleccionado reciente, ir directo a shopping
        if (context.selected_vendor_id && context.selected_vendor_name) {
          console.log(`🛒 INTERCEPTOR: Purchase intent with active vendor "${context.selected_vendor_name}": "${message.trim()}"`);
          // Transicionar a shopping y dejar que la IA procese el agregado al carrito
          if (context.order_state === "idle" || context.order_state === "browsing") {
            context.order_state = "shopping";
            console.log(`🔄 STATE: → shopping (purchase intent with vendor)`);
          }
          // No interceptar, dejar que fluya al LLM con herramientas de shopping
        } 
        // Si hay un solo vendor en el mapa, auto-seleccionarlo y procesar compra
        else if (context.available_vendors_map && context.available_vendors_map.length === 1) {
          const singleVendor = context.available_vendors_map[0];
          console.log(`🛒 INTERCEPTOR: Purchase intent with single vendor available "${singleVendor.name}", auto-selecting and processing: "${message.trim()}"`);
          
          // Auto-seleccionar vendor primero (ver_menu_negocio setea selected_vendor_id)
          await ejecutarHerramienta("ver_menu_negocio", {
            vendor_id: String(singleVendor.index),
          }, context, supabase);
          
          // Ahora procesar la intención de compra con el vendor ya seleccionado
          const shoppingResult = await handleShoppingInterceptor(message, context, supabase);
          if (shoppingResult) {
            context.confusion_count = 0;
            context.conversation_history.push({ role: "assistant", content: shoppingResult });
            await saveContext(context, supabase);
            return shoppingResult;
          }
          
          // Si el shopping interceptor no pudo procesarlo, mostrar el menú
          const menuText = `Estos son los productos de *${singleVendor.name}*. Decime qué querés pedir 😊`;
          context.confusion_count = 0;
          context.conversation_history.push({ role: "assistant", content: menuText });
          await saveContext(context, supabase);
          return menuText;
        }
        // Si hay vendors pero no uno seleccionado, guiar a elegir
        else if (context.available_vendors_map && context.available_vendors_map.length > 1) {
          console.log(`🛒 INTERCEPTOR: Purchase intent without vendor selected, guiding user`);
          const vendorNames = context.available_vendors_map.map(v => `${v.index}️⃣ ${v.name}`).join('\n');
          const response = `Para hacer tu pedido, primero elegí un negocio 🙂\n\n${vendorNames}\n\nDecime el número o nombre.`;
          context.confusion_count = 0;
          context.conversation_history.push({ role: "assistant", content: response });
          await saveContext(context, supabase);
          return response;
        }
        // Sin vendors disponibles, hacer búsqueda normal (caerá al bloque de abajo)
      }

      // 🎯 Búsquedas en idle/browsing → el LLM decide si llamar buscar_productos o ver_locales_abiertos
      // Ya no interceptamos búsquedas explícitas — la IA tiene las herramientas disponibles
    }
    
    // INTERCEPTOR: Estado browsing + número solo → seleccionar negocio de la lista
    if (context.order_state === "browsing" && context.available_vendors_map && context.available_vendors_map.length > 0) {
      const numMatch = message.trim().match(/^(\d+)$/);
      if (numMatch) {
        const idx = parseInt(numMatch[1]);
        const vendor = context.available_vendors_map.find(v => v.index === idx);
        if (vendor) {
          console.log(`🏪 INTERCEPTOR: Numeric selection in browsing → ver_menu_negocio for "${vendor.name}"`);
          const result = await ejecutarHerramienta("ver_menu_negocio", {
            vendor_id: String(idx),
          }, context, supabase);
          
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }
    }

    // 🎯 INTERCEPTOR: Pedido explícito de menú en estado shopping
    // El usuario quiere VER el menú otra vez (no agregar producto)
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      const menuRequest = /^(men[uú]|ver men[uú]|mostrame el men[uú]|menu del local|ver productos|productos|que hay|qué hay|que tienen|qué tienen|ver carta|carta|show menu|ver el men[uú])/i;
      if (menuRequest.test(message.trim())) {
        console.log(`📋 INTERCEPTOR: Explicit menu request in shopping state → showing menu`);
        const result = await ejecutarHerramienta("ver_menu_negocio", {
          vendor_id: context.selected_vendor_id,
        }, context, supabase);
        
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }

    // 🎯 FASE 5: Menú de ayuda estático
    const helpKeywords = /^(ayuda|help|opciones|que puedo hacer|qué puedo hacer|como funciona|cómo funciona|\?|info)$/i;
    if (helpKeywords.test(message.trim())) {
      console.log(`📋 INTERCEPTOR: Static help menu`);
      const helpText = `📋 *¿En qué te puedo ayudar?*\n\n` +
        `🔍 *Ver negocios* → "mostrame los locales"\n` +
        `🍕 *Buscar algo* → "quiero pizza", "busco helado"\n` +
        `🛒 *Tu carrito* → "ver carrito"\n` +
        `📦 *Tu pedido* → "estado de mi pedido"\n` +
        `❌ *Cancelar* → "cancelar pedido"\n` +
        `⭐ *Calificar* → "quiero calificar"\n\n` +
        `Decime qué necesitás y te ayudo 😊`;
      
      context.conversation_history.push({ role: "assistant", content: helpText });
      await saveContext(context, supabase);
      return helpText;
    }

    // 🤖 Lovable AI Gateway (compatible con la API de OpenAI)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const useGateway = !!lovableApiKey;

    const openai = useGateway
      ? new OpenAI({
          apiKey: lovableApiKey,
          baseURL: "https://ai.gateway.lovable.dev/v1",
          defaultHeaders: {
            "Lovable-API-Key": lovableApiKey!,
            "X-Lovable-AIG-SDK": "openai-sdk",
          },
        })
      : new OpenAI({ apiKey: openaiApiKey });

    const AI_MODEL = useGateway ? "google/gemini-3.6-flash" : "gpt-4o-mini";
    console.log(`🧠 AI provider: ${useGateway ? "Lovable AI Gateway" : "OpenAI"} (${AI_MODEL})`);


    console.log("🔄 Starting conversation loop...");

    let continueLoop = true;
    let finalResponse = "";
    let iterationCount = 0;
    const MAX_ITERATIONS = 8; // Aumentado para permitir operaciones complejas // Prevenir loops infinitos
    
    // 🛡️ Rate limiting por herramienta - prevenir loops infinitos
    const toolCallTracker = new Map<string, number>();

    // 🎯 CRÍTICO: Construir mensajes UNA SOLA VEZ antes del loop
    // 🧹 Filtrar historial agresivamente para evitar alucinaciones
    const historyLimit = context.order_state === "idle" ? 1 
      : context.order_state === "browsing" ? 2 
      : 6;
    
    // 🧹 FILTRAR mensajes que contengan menús/listas de productos del historial
    // Estos causan que el modelo use datos viejos en vez de llamar herramientas
    const menuPattern = /\d+\.\s+\*?.+\$[\d.,]+/; // Detecta "1. Producto $precio"
    const filteredHistory = context.conversation_history
      .slice(-historyLimit)
      .filter(msg => {
        // Mantener siempre mensajes del usuario
        if (msg.role === "user") return true;
        // Filtrar mensajes del asistente que contengan menús/listas de productos
        if (msg.role === "assistant" && msg.content && menuPattern.test(msg.content)) {
          console.log("🧹 Filtered out menu-containing message from history");
          return false;
        }
        return true;
      });
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...filteredHistory,
    ];

    // Loop de conversación con tool calling
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
    console.log(`🔁 Iteration ${iterationCount}/${MAX_ITERATIONS}`);
    console.log(`📝 Messages count: ${messages.length}, Last 3 roles:`, messages.slice(-3).map(m => m.role));
    console.log(`🎯 Current state: ${context.order_state || "idle"}`);
    console.log(`🛒 Cart items: ${context.cart.length}`);
      console.log(`🎯 Current state: ${context.order_state || "idle"}`);

      // 🔄 Actualizar SOLO el system prompt (primer mensaje) con el estado actualizado
      messages[0] = { role: "system", content: buildSystemPrompt(context) };

      // 🎯 FASE 1: Filtrado agresivo de herramientas por estado
      const currentState = context.order_state || "idle";
      const filteredTools = filterToolsByState(currentState, context);

      // 🎯 tool_choice siempre "auto" — la IA decide si usar herramienta o responder con texto
      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: messages,
        tools: filteredTools,
        temperature: 0, // 🎯 Determinístico: previene alucinaciones de productos/negocios/pagos
        max_tokens: 800,
        tool_choice: "auto",
      });

      const assistantMessage = completion.choices[0].message;
      console.log("🤖 AI response:", {
        hasContent: !!assistantMessage.content,
        hasToolCalls: !!assistantMessage.tool_calls,
        toolCallsCount: assistantMessage.tool_calls?.length || 0,
      });

      // Si hay tool calls, ejecutarlos
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 📌 Agregar mensaje del asistente con tool calls
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          // 🛡️ Rate limiting: Prevenir que la misma herramienta se llame múltiples veces
          const callCount = toolCallTracker.get(toolName) || 0;
          
          // 🚨 REGLA ESPECIAL: ver_menu_negocio SOLO se puede llamar UNA VEZ por turno
          // Esto evita que se mezclen menús de múltiples negocios
          const maxCalls = toolName === 'ver_menu_negocio' ? 1 : 2;
          
          if (callCount >= maxCalls) {
            if (toolName === 'ver_menu_negocio') {
              console.warn(`⚠️ BLOQUEADO: ver_menu_negocio ya se llamó ${callCount} vez. No se permiten menús múltiples.`);
              // En lugar de romper el loop, retornar mensaje útil
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: "⚠️ Solo puedo mostrarte un menú a la vez. Elegí un negocio de la lista y te muestro su menú.",
              });
              continue; // Continuar con otros tool calls si hay
            }
            console.warn(`⚠️ Tool ${toolName} called ${callCount} times, forcing text response`);
            continueLoop = false;
            finalResponse = "Disculpá, tuve un problema. ¿Podés reformular tu pedido?";
            break;
          }
          toolCallTracker.set(toolName, callCount + 1);
          
          console.log(`🔧 Executing tool: ${toolName} (call #${callCount + 1})`, toolArgs);
          lastToolUsed = toolName;

          const toolResult = await ejecutarHerramienta(toolName, toolArgs, context, supabase);
          console.log(`✅ Tool ${toolName} result preview:`, toolResult.slice(0, 100));

          // 🎯 FASE 4: Si es una herramienta de respuesta directa Y es el único tool call,
          // retornar resultado directamente sin pasar por el LLM para reformateo
          
          if (DIRECT_RESPONSE_TOOLS.has(toolName) && assistantMessage.tool_calls!.length === 1) {
            console.log(`⚡ DIRECT RESPONSE: Returning ${toolName} result directly (no LLM reformatting)`);
            finalResponse = toolResult;
            continueLoop = false;
            
            // 💾 Guardar contexto
            await saveContext(context, supabase);
            break;
          }

          // 📌 Agregar resultado de la herramienta
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        
        // Si se detectó loop o direct response, salir
        if (!continueLoop) {
          break;
        }

        // 💾 CRÍTICO: Guardar contexto después de ejecutar todas las herramientas
        // Reset confusion count on successful tool execution
        context.confusion_count = 0;
        console.log(`💾 Saving context after tool execution - vendor_id: ${context.selected_vendor_id}`);
        await saveContext(context, supabase);

        // Continuar el loop para que la IA procese los resultados
        continue;
      }

      // Si no hay tool calls, es la respuesta final
      console.log("✅ No tool calls - AI responding with text");
      console.log("   Content preview:", assistantMessage.content?.slice(0, 200));
      // Incrementar confusion count cuando la IA no usa herramientas (posible mensaje no reconocido)
      context.confusion_count = (context.confusion_count || 0) + 1;
      finalResponse = assistantMessage.content || getContextualFallback(context);
      continueLoop = false;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn("⚠️ Max iterations reached, forcing response");
      finalResponse = "Disculpá, me trabé un poco. ¿Podés decirme de nuevo qué necesitás?";
    }

    // Agregar respuesta del asistente al historial
    context.conversation_history.push({
      role: "assistant",
      content: finalResponse,
    });

    // Guardar contexto actualizado
    await saveContext(context, supabase);
    console.log("💾 Context saved successfully");

    // 📊 Log ALL interactions (non-blocking)
    try {
      await supabase.from("bot_interaction_logs").insert({
        phone: normalizedPhone,
        message_preview: message.slice(0, 500),
        response_preview: finalResponse.slice(0, 500),
        intent_detected: lastToolUsed || "conversational",
        action_taken: lastToolUsed || "text_response",
        state_before: orderStateBefore,
        state_after: context.order_state || "idle",
        error: null,
      });
    } catch (logErr) {
      console.error("📊 Log insert error:", logErr);
    }

    console.log("🤖 AI Bot END - Returning response");
    return finalResponse;
  } catch (error) {
    console.error("❌ AI Bot ERROR:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    // 🚨 Log error and potentially trigger emergency mode
    const errorMessage = error.message || 'Unknown error';
    const isOpenAIError = errorMessage.includes('OpenAI') || 
                          errorMessage.includes('rate limit') || 
                          errorMessage.includes('API') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('insufficient_quota') ||
                          error.name === 'APIError';
    
    if (isOpenAIError) {
      console.warn('🚨 OpenAI-related error detected, incrementing error count');
      await logBotError(
        supabase,
        'OPENAI_ERROR',
        errorMessage,
        normalizedPhone,
        undefined,
        { name: error.name, stack: error.stack?.substring(0, 500) }
      );
      
      const emergencyActivated = await incrementErrorCount(supabase, errorMessage);
      
      if (emergencyActivated) {
        // Fetch updated settings and handle with fallback
        const updatedSettings = await checkPlatformSettings(supabase);
        if (updatedSettings) {
          return await handleEmergencyFallback(updatedSettings, normalizedPhone, message, supabase);
        }
      }
    } else {
      // Log non-OpenAI errors too
      await logBotError(
        supabase,
        'BOT_ERROR',
        errorMessage,
        normalizedPhone,
        undefined,
        { name: error.name }
      );
    }
    
    // 📊 Log error interaction
    try {
      await supabase.from("bot_interaction_logs").insert({
        phone: normalizedPhone,
        message_preview: message.slice(0, 500),
        response_preview: null,
        intent_detected: null,
        action_taken: "error",
        state_before: null,
        state_after: null,
        error: (error as any).message?.slice(0, 500) || "Unknown error",
      });
    } catch (logErr) {
      console.error("📊 Log insert error:", logErr);
    }

    return "Disculpá, tuve un problema técnico. Por favor intentá de nuevo en un momento.";
  }
}
