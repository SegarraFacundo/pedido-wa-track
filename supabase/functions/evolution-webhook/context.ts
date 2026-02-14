import type { ConversationContext } from "./types.ts";

// ==================== GESTIÓN DE CONTEXTO ====================

// ✅ Verifica si el pedido pendiente sigue activo en la DB
// Si el pedido ya fue entregado/cancelado, limpia el contexto
// IMPORTANTE: Se ejecuta SIEMPRE que haya un pending_order_id, sin importar order_state
async function syncOrderStateWithDB(context: ConversationContext, supabase: any): Promise<void> {
  if (!context.pending_order_id) return;
  
  console.log(`🔄 Syncing order state with DB for order: ${context.pending_order_id}`);
  
  const { data: order, error } = await supabase
    .from("orders")
    .select("status")
    .eq("id", context.pending_order_id)
    .maybeSingle();
  
  if (error) {
    console.error("❌ Error checking order status:", error);
    return;
  }
  
  // Si el pedido no existe o ya terminó, limpiar el contexto
  if (!order || order.status === 'delivered' || order.status === 'cancelled') {
    console.log(`✅ Order ${context.pending_order_id} is ${order?.status || 'not found'}, resetting context`);
    
    // Guardar el ID como último pedido antes de limpiar
    context.last_order_id = context.pending_order_id;
    
    // Limpiar estado de pedido activo
    context.pending_order_id = undefined;
    context.order_state = "idle";
    context.cart = [];
    context.delivery_address = undefined;
    context.payment_method = undefined;
    context.delivery_type = undefined;
    context.resumen_mostrado = false;
    context.payment_methods_fetched = false;
    
    console.log(`🧹 Context cleaned - user can now make new orders`);
  } else {
    console.log(`📦 Order ${context.pending_order_id} is still active with status: ${order.status}`);
  }
}

export async function getContext(phone: string, supabase: any): Promise<ConversationContext> {
  console.log("📂 ========== LOADING CONTEXT ==========");
  console.log("📞 Phone:", phone);
  
  const { data } = await supabase.from("user_sessions").select("*").eq("phone", phone).maybeSingle();

  // Obtener ubicación del usuario si existe
  const userLatitude = data?.user_latitude;
  const userLongitude = data?.user_longitude;

  if (data?.last_bot_message) {
    try {
      const saved = JSON.parse(data.last_bot_message);
      console.log("✅ Context loaded from DB:");
      console.log("🔄 Order State:", saved.order_state || "idle");
      console.log("🛒 Cart items:", saved.cart?.length || 0);
      console.log("🏪 Vendor ID:", saved.selected_vendor_id);
      console.log("🏪 Vendor Name:", saved.selected_vendor_name);
      console.log("📍 User location:", userLatitude && userLongitude ? `${userLatitude}, ${userLongitude}` : "Not set");
      
      console.log("📋 Resumen mostrado:", saved.resumen_mostrado);
      console.log("🚚 Delivery type:", saved.delivery_type);
      console.log("💳 Payment methods:", saved.available_payment_methods?.length || 0);
      
      const context: ConversationContext = {
        phone,
        cart: saved.cart || [],
        order_state: saved.order_state || "idle",
        selected_vendor_id: saved.selected_vendor_id,
        selected_vendor_name: saved.selected_vendor_name,
        delivery_address: saved.delivery_address,
        payment_method: saved.payment_method,
        payment_receipt_url: saved.payment_receipt_url,
        pending_order_id: saved.pending_order_id,
        last_order_id: saved.last_order_id,
        user_latitude: userLatitude,
        user_longitude: userLongitude,
        pending_location_decision: saved.pending_location_decision || false,
        pending_vendor_change: saved.pending_vendor_change,
        conversation_history: saved.conversation_history || [],
        
        // ⭐ CAMPOS CRÍTICOS QUE FALTABAN:
        resumen_mostrado: saved.resumen_mostrado || false,
        delivery_type: saved.delivery_type,
        vendor_allows_pickup: saved.vendor_allows_pickup,
        vendor_allows_delivery: saved.vendor_allows_delivery,
        pickup_instructions: saved.pickup_instructions,
        payment_methods_fetched: saved.payment_methods_fetched || false,
        available_payment_methods: saved.available_payment_methods || [],
        available_vendors_map: saved.available_vendors_map || [],
        last_menu_fetch: saved.last_menu_fetch,
        last_vendors_fetch: saved.last_vendors_fetch,
      };
      
      // ✅ SINCRONIZAR CON LA DB - verificar si el pedido sigue activo
      await syncOrderStateWithDB(context, supabase);
      
      // Si se limpió el contexto, guardarlo
      if (saved.pending_order_id && !context.pending_order_id) {
        await saveContext(context, supabase);
        console.log("💾 Context saved after sync cleanup");
      }
      
      return context;
    } catch (e) {
      console.error("❌ Error parsing context:", e);
    }
  }

  console.log("ℹ️ No context found, creating new context with state: idle");
  return {
    phone,
    cart: [],
    order_state: "idle",
    user_latitude: userLatitude,
    user_longitude: userLongitude,
    pending_location_decision: false,
    conversation_history: [],
  };
}

export async function saveContext(context: ConversationContext, supabase: any): Promise<void> {
  // Mantener solo últimas 10 interacciones para evitar delirios
  if (context.conversation_history.length > 10) {
    context.conversation_history = context.conversation_history.slice(-10);
  }

  console.log("💾 ========== SAVING CONTEXT ==========");
  console.log("🔄 Order State:", context.order_state || "idle");
  console.log("🏪 Vendor ID:", context.selected_vendor_id);
  console.log("📦 Cart preview:", context.cart.length === 0 ? "empty" : `${context.cart.length} items`);
  console.log("📍 Delivery address:", context.delivery_address);
  console.log("💳 Payment method:", context.payment_method);
  console.log("🆔 Pending order:", context.pending_order_id);
  console.log("📞 Phone:", context.phone);

  if (!context.phone) {
    console.error("❌ Cannot save context without phone number!");
    return;
  }

  const { error } = await supabase.from("user_sessions").upsert(
    {
      phone: context.phone,
      last_bot_message: JSON.stringify(context),
      user_latitude: context.user_latitude,
      user_longitude: context.user_longitude,
    },
    { onConflict: "phone" }
  );

  if (error) {
    console.error("❌ Error saving context:", error);
  } else {
    console.log("✅ Context saved successfully");
  }
}
