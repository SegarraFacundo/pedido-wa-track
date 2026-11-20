// ============================================================
// Edge function: enviar-mensaje-vendedor
// El cliente (autenticado) le escribe al vendedor sobre un pedido suyo.
// Crea/reutiliza el hilo en vendor_chats y guarda el mensaje en chat_messages.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { order_id, message } = (await req.json()) as { order_id?: string; message?: string };
    if (!order_id) return json({ error: "Falta el pedido" }, 400);
    if (!message || message.trim().length < 1) return json({ error: "Escribí un mensaje" }, 400);

    // El pedido debe ser del cliente; de ahí sacamos vendor y teléfono.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, vendor_id, customer_phone")
      .eq("id", order_id)
      .maybeSingle();
    if (orderError || !order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.user_id !== userId) return json({ error: "Este pedido no es tuyo" }, 403);

    // Buscar hilo activo o crearlo.
    const { data: existing } = await supabase
      .from("vendor_chats")
      .select("id")
      .eq("vendor_id", order.vendor_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    let chatId = existing?.id;
    if (!chatId) {
      const { data: newChat, error: chatError } = await supabase
        .from("vendor_chats")
        .insert({
          vendor_id: order.vendor_id,
          user_id: userId,
          customer_phone: order.customer_phone,
          is_active: true,
        })
        .select("id")
        .single();
      if (chatError || !newChat) {
        console.error("Error creando chat:", chatError);
        return json({ error: "No se pudo abrir el chat" }, 500);
      }
      chatId = newChat.id;
    }

    const { error: msgError } = await supabase.from("chat_messages").insert({
      chat_id: chatId,
      sender_type: "customer",
      message: message.trim(),
    });
    if (msgError) {
      console.error("Error guardando mensaje:", msgError);
      return json({ error: "No se pudo enviar el mensaje" }, 500);
    }

    try {
      await supabase.functions.invoke("notify-vendor", {
        body: { orderId: order_id, eventType: "customer_message", vendorId: order.vendor_id },
      });
    } catch (_e) { /* el aviso no debe bloquear el mensaje */ }

    return json({ success: true, chat_id: chatId });
  } catch (e) {
    console.error("enviar-mensaje-vendedor error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
