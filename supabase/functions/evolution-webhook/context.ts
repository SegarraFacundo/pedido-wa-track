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
      console.log("🛒 Cart items:", saved.cart?.length || 0);
      console.log("🏪 Vendor ID:", saved.selected_vendor_id);
      console.log("🏪 Vendor Name:", saved.selected_vendor_name);
      console.log("📍 User location:", userLatitude && userLongitude ? `${userLatitude}, ${userLongitude}` : "Not set");
      
      return {
        phone,
        cart: saved.cart || [],
        selected_vendor_id: saved.selected_vendor_id,
        selected_vendor_name: saved.selected_vendor_name,
        delivery_address: saved.delivery_address,
        payment_method: saved.payment_method,
        payment_receipt_url: saved.payment_receipt_url,
        pending_order_id: saved.pending_order_id,
        user_latitude: userLatitude,
        user_longitude: userLongitude,
        pending_location_decision: saved.pending_location_decision || false,
        conversation_history: saved.conversation_history || [],
      };
    } catch (e) {
      console.error("❌ Error parsing context:", e);
    }
  }

  console.log("ℹ️ No context found, creating new context");
  return {
    phone,
    cart: [],
    user_latitude: userLatitude,
    user_longitude: userLongitude,
    pending_location_decision: false,
    conversation_history: [],
  };
}

export async function saveContext(context: ConversationContext, supabase: any): Promise<void> {
  // Mantener solo últimas 20 interacciones para no saturar
  if (context.conversation_history.length > 20) {
    context.conversation_history = context.conversation_history.slice(-20);
  }

  console.log("💾 ========== SAVING CONTEXT ==========");
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
      last_message_at: new Date().toISOString(),
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
