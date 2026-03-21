// ==================== BOT HELPERS: Constants, filters, interceptors ====================

import { ConversationContext, CartItem } from "./types.ts";
import { saveContext } from "./context.ts";
import { tools } from "./tools-definitions.ts";
import { t, Language } from "./i18n.ts";

// ==================== FASE 1: FILTRADO DE HERRAMIENTAS POR ESTADO ====================

export const TOOLS_BY_STATE: Record<string, string[]> = {
  idle: ["buscar_productos", "ver_locales_abiertos", "mostrar_menu_ayuda", "ver_estado_pedido", "registrar_calificacion", "calificar_plataforma", "ver_horario_negocio"],
  browsing: ["ver_menu_negocio", "buscar_productos", "ver_locales_abiertos", "mostrar_menu_ayuda", "ver_horario_negocio"],
  shopping: [
    "agregar_al_carrito", "quitar_producto_carrito", "ver_carrito",
    "modificar_carrito_completo",
    "seleccionar_tipo_entrega", "confirmar_direccion_entrega",
    "ver_metodos_pago", "seleccionar_metodo_pago",
    "mostrar_resumen_pedido", "vaciar_carrito", "crear_pedido",
  ],
  needs_address: ["confirmar_direccion_entrega", "vaciar_carrito", "ver_carrito"],
  checkout: ["seleccionar_metodo_pago", "mostrar_resumen_pedido", "crear_pedido", "ver_carrito", "vaciar_carrito"],
  order_pending_cash: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma", "ver_horario_negocio"],
  order_pending_transfer: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma", "ver_horario_negocio"],
  order_pending_mp: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma", "ver_horario_negocio"],
  order_confirmed: ["ver_estado_pedido", "cancelar_pedido", "hablar_con_vendedor", "registrar_calificacion", "calificar_plataforma", "ver_horario_negocio"],
  order_completed: ["ver_estado_pedido", "registrar_calificacion", "calificar_plataforma", "buscar_productos", "ver_locales_abiertos", "ver_horario_negocio"],
  order_cancelled: ["buscar_productos", "ver_locales_abiertos", "ver_estado_pedido", "ver_horario_negocio"],
};

// FASE 4: Herramientas cuya salida se retorna directamente sin reformateo del LLM
export const DIRECT_RESPONSE_TOOLS = new Set([
  "ver_locales_abiertos",
  "ver_menu_negocio",
  "ver_carrito",
  "mostrar_resumen_pedido",
  "mostrar_menu_ayuda",
  "ver_estado_pedido",
  "ver_ofertas",
  "buscar_productos",
  "ver_horario_negocio",
]);

export function filterToolsByState(state: string, _context: ConversationContext) {
  const allowedNames = TOOLS_BY_STATE[state] || TOOLS_BY_STATE["idle"];
  const withSupport = [...allowedNames, "crear_ticket_soporte"];
  return tools.filter(t => withSupport.includes(t.function.name));
}

// ==================== HELPER: REAL-TIME VENDOR CONFIG ====================

export async function getVendorConfig(vendorId: string, supabase: any) {
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
    allows_delivery: data?.allows_delivery ?? true,
    pickup_instructions: data?.pickup_instructions,
    address: data?.address,
    is_active: data?.is_active ?? true,
    name: data?.name
  };
}

// ==================== INTERCEPTOR: SHOPPING + NÚMERO/PRODUCTO ====================

export async function handleShoppingInterceptor(
  message: string,
  context: ConversationContext,
  supabase: any
): Promise<string | null> {
  const text = message.trim();
  const vendorId = context.selected_vendor_id;
  if (!vendorId) return null;

  const lang = (context.language || 'es') as Language;

  // 🔍 Pre-process: extract multi-intent parts
  let productPart = text;
  let addressPart: string | null = null;
  let paymentPart: string | null = null;

  // Extract address
  const addressMatch = text.match(/(?:enviam?elo?\s+a|enviar\s+a|direcci[oó]n\s+|a\s+la\s+direcci[oó]n\s+)([\w\s.,]+?)(?:\s+y\s+pago|\s+pago\s+|$)/i);
  if (addressMatch) {
    addressPart = addressMatch[1].trim();
    productPart = text.substring(0, text.indexOf(addressMatch[0])).trim();
  }

  // Extract payment
  const paymentMatch = text.match(/pago\s+(?:en\s+|con\s+)?(efectivo|transferencia|mercadopago|mp)/i);
  if (paymentMatch) {
    paymentPart = paymentMatch[1].toLowerCase().trim();
    if (!addressPart) {
      productPart = text.substring(0, text.indexOf(paymentMatch[0])).trim();
    }
  }

  // Use productPart for matching
  const matchText = productPart || text;

  // Detect number + optional quantity pattern: "2 remeras", "1", "3x2"
  const numberMatch = matchText.match(/^(\d+)\s*(?:x\s*(\d+)|unidades?|de\s+)?(.*)$/i);

  if (!numberMatch) return null;

  const firstNum = parseInt(numberMatch[1]);
  const secondNum = numberMatch[2] ? parseInt(numberMatch[2]) : null;
  const restText = (numberMatch[3] || "").trim().toLowerCase();

  // Get vendor products
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, stock_enabled, stock_quantity")
    .eq("vendor_id", vendorId)
    .eq("is_available", true)
    .order("name");

  if (error || !products || products.length === 0) return null;

  let selectedProduct: any = null;
  let quantity = 1;

  // Case 1: "3" → product #3 from menu (1 unit)
  if (!secondNum && !restText && firstNum >= 1 && firstNum <= products.length) {
    selectedProduct = products[firstNum - 1];
    quantity = 1;
  }
  // Case 2: "2x3" or "2 x 3" → 2 units of product #3
  else if (secondNum && secondNum >= 1 && secondNum <= products.length) {
    selectedProduct = products[secondNum - 1];
    quantity = firstNum;
  }
  // Case 3: "2 remeras" → 2 units of "remeras"
  else if (restText && firstNum >= 1 && firstNum <= 99) {
    quantity = firstNum;
    const found = products.find((p: any) =>
      p.name.toLowerCase().includes(restText) ||
      restText.includes(p.name.toLowerCase())
    );
    if (found) selectedProduct = found;
  }

  if (!selectedProduct) return null;

  // Stock validation
  if (selectedProduct.stock_enabled) {
    const available = selectedProduct.stock_quantity || 0;
    const existingInCart = context.cart.find((c: CartItem) => c.product_id === selectedProduct.id);
    const alreadyInCart = existingInCart?.quantity || 0;
    const totalRequested = alreadyInCart + quantity;

    if (available <= 0) {
      return t('stock.out_of_stock', lang, { product: selectedProduct.name });
    }
    if (totalRequested > available) {
      const canAdd = available - alreadyInCart;
      if (canAdd <= 0) {
        return t('stock.max_interceptor', lang, { count: String(alreadyInCart), product: selectedProduct.name, max: String(available) });
      }
      return t('stock.limited_interceptor', lang, { available: String(available), product: selectedProduct.name, count: String(alreadyInCart) });
    }
  }

  // Add to cart
  const existing = context.cart.find((c: CartItem) => c.product_id === selectedProduct.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    context.cart.push({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      price: selectedProduct.price,
    });
  }

  // Process address if extracted
  if (addressPart) {
    context.delivery_type = 'delivery';
    context.delivery_address = addressPart;
    console.log(`📍 Auto-extracted address: ${addressPart}`);
  }

  // Process payment if extracted
  if (paymentPart) {
    const methodMap: Record<string, string> = {
      'efectivo': 'efectivo', 'transferencia': 'transferencia',
      'mercadopago': 'mercadopago', 'mp': 'mercadopago'
    };
    const mapped = methodMap[paymentPart];
    if (mapped && (!context.available_payment_methods?.length || context.available_payment_methods.includes(mapped))) {
      context.payment_method = mapped;
      console.log(`💳 Auto-extracted payment: ${mapped}`);
    }
  }

  const total = context.cart.reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0);
  const cartDetail = context.cart.map((item: CartItem, idx: number) => 
    `${idx + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}`
  ).join('\n');

  await saveContext(context, supabase);

  return t('cart.added', lang, { 
    product: selectedProduct.name, 
    qty: String(quantity), 
    vendor: context.selected_vendor_name || '', 
    total: String(total),
    cart_detail: cartDetail,
  });
}

// ==================== HELPER: TRACK VENDOR CHANGE ====================

export async function trackVendorChange(
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
