import type { ConversationContext } from "./types.ts";

// ==================== GESTIÓN DE CONTEXTO ====================

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
      
      return {
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
      };
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
