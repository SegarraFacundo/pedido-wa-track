// ==================== STATE MACHINE: Deterministic intent processor ====================
// All logic, flow control, and responses are handled here — no AI text generation.

import { ConversationContext } from "./types.ts";
import { Intent, NLUResult } from "./nlu.ts";
import { ejecutarHerramienta } from "./tool-handlers.ts";
import { t, Language, detectPaymentMethod } from "./i18n.ts";
import { saveContext } from "./context.ts";
import { handleShoppingInterceptor } from "./bot-helpers.ts";

// ==================== CONTEXT LEVEL DETECTION ====================
// Determines which menu to show based on user's current context

export type ContextLevel = 1 | 2 | 3 | 4;

export function getContextLevel(context: ConversationContext): ContextLevel {
  // Level 4: Completed order
  if (context.order_state === "order_completed") return 4;
  
  // Level 3: Active order (pending/confirmed)
  const activeOrderStates = ["order_pending_cash", "order_pending_transfer", "order_pending_mp", "order_confirmed"];
  if (context.pending_order_id && activeOrderStates.includes(context.order_state || "")) return 3;
  
  // Level 2: Vendor selected (browsing/shopping)
  if (context.selected_vendor_id) return 2;
  
  // Level 1: No context
  return 1;
}

function getContextualMenu(context: ConversationContext, lang: Language): string {
  const level = getContextLevel(context);
  
  switch (level) {
    case 4:
      return t("welcome.menu_completed", lang);
    case 3: {
      const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : "???";
      return t("welcome.menu_active_order", lang, { id: orderId });
    }
    case 2:
      return t("welcome.menu_vendor", lang, { vendor: context.selected_vendor_name || "" });
    case 1:
    default:
      return t("welcome.menu_clean", lang);
  }
}

// ==================== CONTEXT HEADER ====================
// Shows the user where they are (vendor, cart) to reduce confusion

function buildContextHeader(context: ConversationContext, lang: Language): string {
  const parts: string[] = [];
  
  if (context.selected_vendor_name) {
    parts.push(`📍 ${lang === "es" ? "Negocio" : lang === "en" ? "Store" : lang === "pt" ? "Loja" : "店舗"}: *${context.selected_vendor_name}*`);
  }
  
  if (context.cart.length > 0) {
    const total = Math.round(context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const itemCount = context.cart.reduce((sum, item) => sum + item.quantity, 0);
    parts.push(`🛒 ${lang === "es" ? "Carrito" : lang === "en" ? "Cart" : lang === "pt" ? "Carrinho" : "カート"}: ${itemCount} ${lang === "es" ? "productos" : lang === "en" ? "items" : lang === "pt" ? "produtos" : "商品"} ($${total})`);
  }
  
  if (parts.length === 0) return "";
  return parts.join(" | ") + "\n\n";
}

export interface StateMachineResult {
  response: string;
  handled: boolean;  // false means NLU couldn't help, use fallback
}

// Valid intents per state
const VALID_INTENTS_BY_STATE: Record<string, Intent[]> = {
  idle: ["browse_stores", "search_product", "select_vendor", "view_menu", "check_status", "rate_order", "rate_platform", "view_schedule", "view_offers", "help", "reset", "change_language", "talk_to_human", "add_to_cart", "greeting"],
  browsing: ["select_vendor", "view_menu", "browse_stores", "search_product", "check_status", "rate_order", "rate_platform", "view_offers", "view_schedule", "help", "reset", "change_language", "talk_to_human", "greeting"],
  shopping: ["add_to_cart", "remove_from_cart", "view_cart", "empty_cart", "confirm_order", "select_delivery", "give_address", "select_payment", "view_menu", "browse_stores", "view_schedule", "help", "reset", "change_language", "talk_to_human", "check_status", "cancel_order", "greeting"],
  needs_address: ["give_address", "view_cart", "empty_cart", "help", "reset", "cancel_order", "change_language", "greeting"],
  checkout: ["select_payment", "view_cart", "empty_cart", "confirm_order", "help", "reset", "cancel_order", "change_language", "greeting"],
  order_pending_cash: ["check_status", "cancel_order", "talk_to_human", "rate_order", "rate_platform", "view_schedule", "help", "greeting"],
  order_pending_transfer: ["check_status", "cancel_order", "talk_to_human", "rate_order", "rate_platform", "view_schedule", "help", "confirm_order", "greeting"],
  order_pending_mp: ["check_status", "cancel_order", "talk_to_human", "rate_order", "rate_platform", "view_schedule", "help", "greeting"],
  order_confirmed: ["check_status", "cancel_order", "talk_to_human", "rate_order", "rate_platform", "view_schedule", "help", "greeting"],
  order_completed: ["check_status", "rate_order", "rate_platform", "browse_stores", "search_product", "view_schedule", "help", "reset", "greeting"],
  order_cancelled: ["browse_stores", "search_product", "check_status", "view_schedule", "help", "reset", "greeting"],
};

// Step instructions for retry messages
const STEP_HINTS: Record<string, Record<Language, string>> = {
  idle: {
    es: "Enviá un *número* del menú o escribí lo que necesitás.",
    en: "Send a *number* from the menu or write what you need.",
    pt: "Envie um *número* do menu ou escreva o que precisa.",
    ja: "メニューから*番号*を送るか、必要なことを書いてください。",
  },
  browsing: {
    es: "Elegí un negocio enviando su *número* o *nombre* de la lista.",
    en: "Choose a store by sending its *number* or *name* from the list.",
    pt: "Escolha uma loja enviando o *número* ou *nome* da lista.",
    ja: "リストから店舗の*番号*か*名前*を送ってください。",
  },
  shopping: {
    es: "Enviá un *número del menú* para agregar, \"carrito\" para ver tu pedido, o \"confirmar\" para finalizar.",
    en: "Send a *menu number* to add, \"cart\" to see your order, or \"confirm\" to finalize.",
    pt: "Envie um *número do cardápio* para adicionar, \"carrinho\" para ver seu pedido, ou \"confirmar\" para finalizar.",
    ja: "*メニュー番号*を送って追加、「カート」で確認、「確定」で完了。",
  },
  needs_address: {
    es: "Escribí tu dirección de entrega (calle y número).",
    en: "Write your delivery address (street and number).",
    pt: "Escreva seu endereço de entrega (rua e número).",
    ja: "配送先住所を入力してください（通り名と番号）。",
  },
  checkout: {
    es: "Elegí un método de pago (número o nombre).",
    en: "Choose a payment method (number or name).",
    pt: "Escolha um método de pagamento (número ou nome).",
    ja: "支払い方法を選択してください（番号または名前）。",
  },
};

export async function processIntent(
  nlu: NLUResult,
  context: ConversationContext,
  supabase: any,
): Promise<StateMachineResult> {
  const state = context.order_state || "idle";
  const lang = (context.language || "es") as Language;
  const { intent, params } = nlu;

  // Check if intent is valid for current state
  const validIntents = VALID_INTENTS_BY_STATE[state] || VALID_INTENTS_BY_STATE["idle"];
  
  if (intent === "unknown" || !validIntents.includes(intent)) {
    return handleInvalidIntent(context, state, lang);
  }

  // Reset retry count on valid intent
  context.retry_count = 0;

  // Dispatch to handler
  switch (intent) {
    case "browse_stores":
      return handleBrowseStores(context, supabase, lang, state);

    case "search_product":
      return handleSearchProduct(params, context, supabase, lang);

    case "select_vendor":
    case "view_menu":
      return handleSelectVendor(params, context, supabase, lang, state);

    case "add_to_cart":
      return handleAddToCart(params, context, supabase, lang);

    case "remove_from_cart":
      return handleRemoveFromCart(params, context, supabase, lang);

    case "view_cart":
      return handleViewCart(context, supabase, lang);

    case "empty_cart":
      return handleEmptyCart(context, supabase, lang);

    case "confirm_order":
      return handleConfirmOrder(context, supabase, lang);

    case "select_delivery":
      return handleSelectDelivery(params, context, supabase, lang);

    case "give_address":
      return handleGiveAddress(params, context, supabase, lang);

    case "select_payment":
      return handleSelectPayment(params, context, supabase, lang);

    case "check_status":
      return handleCheckStatus(context, supabase, lang);

    case "cancel_order":
      return handleCancelOrder(context, supabase, lang);

    case "rate_order": {
      const response = t("rating.prompt_order", lang);
      return { response, handled: true };
    }

    case "rate_platform": {
      const response = t("rating.prompt_platform", lang);
      return { response, handled: true };
    }

    case "talk_to_human":
      return handleTalkToHuman(context, supabase, lang);

    case "view_schedule":
      return handleViewSchedule(context, supabase, lang);

    case "view_offers":
      return handleViewOffers(context, supabase, lang);

    case "help": {
      const response = t("help.full", lang);
      return { response, handled: true };
    }

    case "reset":
      // This is handled earlier in vendor-bot.ts interceptors
      return { response: t("reset.done", lang), handled: true };

    case "change_language":
      // This is handled earlier in vendor-bot.ts interceptors
      return { response: t("language.changed", lang), handled: true };

    case "greeting":
      return { response: getContextualMenu(context, lang), handled: true };

    default:
      return handleInvalidIntent(context, state, lang);
  }
}

// ==================== HANDLERS ====================

function handleInvalidIntent(
  context: ConversationContext,
  state: string,
  lang: Language,
): StateMachineResult {
  const retryCount = (context.retry_count || 0) + 1;
  context.retry_count = retryCount;

  // In idle state, show contextual menu instead of error
  if (state === "idle" || state === "order_completed" || state === "order_cancelled") {
    context.retry_count = 0;
    return { response: getContextualMenu(context, lang), handled: true };
  }

  // 3rd retry: force reset to idle + show main menu
  if (retryCount >= 3) {
    context.retry_count = 0;
    context.order_state = "idle";
    context.cart = [];
    context.selected_vendor_id = undefined;
    context.selected_vendor_name = undefined;
    context.payment_method = undefined;
    context.delivery_address = undefined;
    context.delivery_type = undefined;
    context.payment_methods_fetched = false;
    context.available_payment_methods = [];
    context.resumen_mostrado = false;
    context.conversation_history = [];
    context.available_vendors_map = [];
    const resetMenu = t("welcome.menu_clean", lang);
    return { response: t("error.forced_reset", lang) + resetMenu, handled: true };
  }

  // 2nd retry: show escalation menu with numbered options
  if (retryCount >= 2) {
    const header = buildContextHeader(context, lang);
    return { response: header + t("error.escalation_menu", lang), handled: true };
  }

  // First retry: repeat step instruction with context header
  const hint = STEP_HINTS[state]?.[lang] || STEP_HINTS["idle"][lang];
  const header = buildContextHeader(context, lang);
  const vendorName = context.selected_vendor_name || '';
  const response = state === "shopping" 
    ? t("shopping.not_understood", lang, { vendor: vendorName })
    : `${header}🤔 ${t("error.not_understood", lang)}\n\n${hint}`;
  return { response, handled: true };
}

async function handleBrowseStores(
  context: ConversationContext,
  supabase: any,
  lang: Language,
  state: string,
): Promise<StateMachineResult> {
  // If in shopping with items, warn
  if (state === "shopping" && context.cart.length > 0) {
    return {
      response: t("shopping.wrong_vendor", lang, { vendor: context.selected_vendor_name || "" }),
      handled: true,
    };
  }

  // Clear context if switching
  if (state === "shopping" && context.cart.length === 0) {
    context.order_state = "idle";
    context.selected_vendor_id = undefined;
    context.selected_vendor_name = undefined;
    context.payment_method = undefined;
    context.delivery_address = undefined;
    context.delivery_type = undefined;
    context.payment_methods_fetched = false;
    context.available_payment_methods = [];
    context.resumen_mostrado = false;
    context.conversation_history = [];
    await saveContext(context, supabase);
  }

  const result = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
  return { response: result, handled: true };
}

async function handleSearchProduct(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const query = params.query || "";
  if (!query) {
    return { response: t("error.not_understood", lang), handled: true };
  }
  const result = await ejecutarHerramienta("buscar_productos", { consulta: query }, context, supabase);
  return { response: result, handled: true };
}

async function handleSelectVendor(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
  state: string,
): Promise<StateMachineResult> {
  const vendorRef = params.vendor_ref || params.vendor_id || "";

  // If already in shopping, show current menu
  if (state === "shopping" && context.selected_vendor_id && !vendorRef) {
    const result = await ejecutarHerramienta("ver_menu_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
    return { response: result, handled: true };
  }

  if (!vendorRef && context.selected_vendor_id) {
    const result = await ejecutarHerramienta("ver_menu_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
    return { response: result, handled: true };
  }

  const result = await ejecutarHerramienta("ver_menu_negocio", { vendor_id: String(vendorRef) }, context, supabase);
  return { response: result, handled: true };
}

async function handleAddToCart(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  if (!context.selected_vendor_id) {
    return { response: t("shopping.need_vendor_first", lang), handled: true };
  }

  // If the message contained product_ref and quantity, try shopping interceptor first
  const productRef = params.product_ref || "";
  const quantity = params.quantity || 1;

  if (productRef) {
    // Construct a message like "2 pizza" or just "3" for the interceptor
    const syntheticMessage = quantity > 1 ? `${quantity} ${productRef}` : productRef;
    const interceptorResult = await handleShoppingInterceptor(syntheticMessage, context, supabase);
    if (interceptorResult) {
      await saveContext(context, supabase);
      return { response: interceptorResult, handled: true };
    }
  }

  // Fallback: show not understood with menu hint
  return { response: t("shopping.not_understood", lang, { vendor: context.selected_vendor_name || '' }), handled: true };
}

async function handleRemoveFromCart(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const productRef = params.product_ref || "";
  const requestedQty = params.quantity;
  
  if (context.cart.length === 0) {
    return { response: t("cart.empty", lang), handled: true };
  }

  const cartDetail = context.cart.map((item, idx) => 
    `${idx + 1}. ${item.product_name} x${item.quantity} - $${Math.round(item.price * item.quantity)}`
  ).join('\n');

  // Try to match by number index
  const numRef = parseInt(productRef);
  let matchIdx = -1;

  if (!isNaN(numRef) && numRef >= 1 && numRef <= context.cart.length) {
    matchIdx = numRef - 1;
  } else if (productRef) {
    matchIdx = context.cart.findIndex(item => 
      item.product_name.toLowerCase().includes(productRef.toLowerCase()) ||
      productRef.toLowerCase().includes(item.product_name.toLowerCase())
    );
  }

  if (matchIdx < 0) {
    return { response: t("cart.remove_not_found", lang, { cart_detail: cartDetail }), handled: true };
  }

  const item = context.cart[matchIdx];
  const removedProduct = item.product_name;

  // Determine how many to remove
  let removeCount: number;
  if (requestedQty === "all" || requestedQty === "todas" || requestedQty === "todos") {
    removeCount = item.quantity;
  } else if (typeof requestedQty === "number" && requestedQty > 0) {
    removeCount = Math.min(requestedQty, item.quantity);
  } else if (typeof requestedQty === "string" && !isNaN(parseInt(requestedQty))) {
    removeCount = Math.min(parseInt(requestedQty), item.quantity);
  } else {
    // No quantity specified: remove 1 unit
    removeCount = 1;
  }

  item.quantity -= removeCount;
  if (item.quantity <= 0) {
    context.cart.splice(matchIdx, 1);
  }

  await saveContext(context, supabase);

  if (context.cart.length === 0) {
    context.order_state = "shopping";
    context.resumen_mostrado = false;
    await saveContext(context, supabase);
    return { response: `🗑️ *${removedProduct}* (x${removeCount}) eliminado. Tu carrito está vacío.\n\n` + t("shopping.not_understood", lang, { vendor: context.selected_vendor_name || '' }), handled: true };
  }

  const newCartDetail = context.cart.map((item, idx) => 
    `${idx + 1}. ${item.product_name} x${item.quantity} - $${Math.round(item.price * item.quantity)}`
  ).join('\n');
  const total = Math.round(context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));

  return { response: t("cart.removed", lang, { product: `${removedProduct} (x${removeCount})`, vendor: context.selected_vendor_name || '', cart_detail: newCartDetail, total: String(total) }), handled: true };
}

async function handleViewCart(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const result = await ejecutarHerramienta("ver_carrito", {}, context, supabase);
  return { response: result, handled: true };
}

async function handleEmptyCart(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const result = await ejecutarHerramienta("vaciar_carrito", {}, context, supabase);
  await saveContext(context, supabase);
  return { response: result, handled: true };
}

async function handleConfirmOrder(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  if (context.cart.length === 0) {
    return { response: t("confirm.empty_cart", lang, { vendor: context.selected_vendor_name || "" }), handled: true };
  }

  // If all info is ready and summary was shown, create the order
  if (context.resumen_mostrado && context.delivery_type && context.payment_method) {
    const result = await ejecutarHerramienta("crear_pedido", {
      direccion: context.delivery_address || "",
      metodo_pago: context.payment_method,
    }, context, supabase);
    await saveContext(context, supabase);
    return { response: result, handled: true };
  }

  // If all info ready but summary not shown, show summary
  if (context.delivery_type && context.payment_method && !context.resumen_mostrado) {
    const result = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
    await saveContext(context, supabase);
    return { response: result, handled: true };
  }

  // Show cart and ask for missing info
  const cartSummary = await ejecutarHerramienta("ver_carrito", {}, context, supabase);
  let confirmResponse = cartSummary;

  if (!context.delivery_type) {
    confirmResponse += "\n\n" + t("delivery.ask_type", lang);
  } else if (context.delivery_type === "delivery" && !context.delivery_address) {
    confirmResponse += "\n\n" + t("delivery.ask_address", lang);
  } else if (!context.payment_method) {
    const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
    confirmResponse += "\n\n" + paymentResult;
  }

  await saveContext(context, supabase);
  return { response: confirmResponse, handled: true };
}

async function handleSelectDelivery(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const tipo = params.type || params.tipo || "";
  const normalizedType = tipo.toLowerCase();

  let deliveryType = "";
  if (/pickup|retir|local|retirada|受け取り/i.test(normalizedType)) {
    deliveryType = "pickup";
  } else if (/delivery|envio|domicilio|entreg|配達/i.test(normalizedType)) {
    deliveryType = "delivery";
  } else {
    return { response: t("delivery.ask_type", lang), handled: true };
  }

  const result = await ejecutarHerramienta("seleccionar_tipo_entrega", { tipo: deliveryType }, context, supabase);
  await saveContext(context, supabase);
  return { response: result, handled: true };
}

async function handleGiveAddress(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const address = params.address || "";
  if (!address || address.length < 3) {
    return { response: t("address.too_short", lang), handled: true };
  }

  const result = await ejecutarHerramienta("confirmar_direccion_entrega", { direccion: address }, context, supabase);
  await saveContext(context, supabase);
  return { response: result, handled: true };
}

async function handleSelectPayment(
  params: Record<string, any>,
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const method = params.method || "";

  if (!method) {
    // Show payment methods
    const result = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
    await saveContext(context, supabase);
    return { response: result, handled: true };
  }

  // Try to select payment and then create order
  const detected = detectPaymentMethod(method) || method;

  // Check if we need to fetch methods first
  if (!context.payment_methods_fetched || !context.available_payment_methods?.length) {
    const methodsResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
    await saveContext(context, supabase);
    // Now try to select
    if (context.available_payment_methods?.includes(detected)) {
      context.payment_method = detected;
      await saveContext(context, supabase);

      // Auto-create order if all info is ready
      if (context.delivery_type && (context.delivery_address || context.delivery_type === "pickup")) {
        const orderResult = await ejecutarHerramienta("crear_pedido", {
          direccion: context.delivery_address || "",
          metodo_pago: detected,
        }, context, supabase);
        await saveContext(context, supabase);
        return { response: orderResult, handled: true };
      }
      const icons: Record<string, string> = { efectivo: "💵", transferencia: "🏦", mercadopago: "💳" };
      return { response: `✅ ${t("label.payment_method", lang)}: ${icons[detected] || "💰"} ${detected}`, handled: true };
    }
    return { response: methodsResult, handled: true };
  }

  if (!context.available_payment_methods?.includes(detected)) {
    const available = context.available_payment_methods?.map((m, i) => `${i + 1}. ${m}`).join("\n") || "";
    return { response: t("payment.not_available", lang, { method: method, available }), handled: true };
  }

  context.payment_method = detected;
  await saveContext(context, supabase);

  // Auto-create order if all info is ready
  if (context.delivery_type && (context.delivery_address || context.delivery_type === "pickup")) {
    const orderResult = await ejecutarHerramienta("crear_pedido", {
      direccion: context.delivery_address || "",
      metodo_pago: detected,
    }, context, supabase);
    await saveContext(context, supabase);
    return { response: orderResult, handled: true };
  }

  const icons: Record<string, string> = { efectivo: "💵", transferencia: "🏦", mercadopago: "💳" };
  return { response: `✅ ${t("label.payment_method", lang)}: ${icons[detected] || "💰"} ${detected}`, handled: true };
}

async function handleCheckStatus(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const result = await ejecutarHerramienta("ver_estado_pedido", {}, context, supabase);
  return { response: result, handled: true };
}

async function handleCancelOrder(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  // If no pending order (e.g. shopping state), just reset to idle
  if (!context.pending_order_id) {
    context.order_state = "idle";
    context.cart = [];
    context.selected_vendor_id = undefined;
    context.selected_vendor_name = undefined;
    context.payment_method = undefined;
    context.delivery_address = undefined;
    context.delivery_type = undefined;
    context.payment_methods_fetched = false;
    context.available_payment_methods = [];
    context.resumen_mostrado = false;
    context.conversation_history = [];
    context.available_vendors_map = [];
    await saveContext(context, supabase);
    return { response: t("reset.done", lang), handled: true };
  }

  // Initiate cancellation flow for active order
  context.pending_cancellation = {
    step: "awaiting_reason",
    order_id: context.pending_order_id || context.last_order_id,
  };
  await saveContext(context, supabase);
  return { response: t("cancel.ask_reason", lang), handled: true };
}

async function handleTalkToHuman(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const result = await ejecutarHerramienta("hablar_con_vendedor", {}, context, supabase);
  return { response: result, handled: true };
}

async function handleViewSchedule(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  if (context.selected_vendor_id) {
    const result = await ejecutarHerramienta("ver_horario_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
    return { response: result, handled: true };
  }
  if (context.available_vendors_map?.length) {
    return { response: t("schedule.ask_vendor", lang), handled: true };
  }
  const storesResult = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
  return { response: storesResult + "\n\n" + t("schedule.ask_vendor", lang), handled: true };
}

async function handleViewOffers(
  context: ConversationContext,
  supabase: any,
  lang: Language,
): Promise<StateMachineResult> {
  const result = await ejecutarHerramienta("ver_ofertas", {}, context, supabase);
  return { response: result, handled: true };
}
