// ============================================================
// Edge function: cancelar-pedido
// El cliente (autenticado) cancela su propio pedido con un motivo.
// Porta la lógica de evolution-webhook/tool-handlers.ts (case "cancelar_pedido").
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Estados que todavía se pueden cancelar (no "ready", "delivered" ni "cancelled").
const CANCELABLE = ["pending", "confirmed", "preparing"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { order_id, reason } = (await req.json()) as { order_id?: string; reason?: string };
    if (!order_id) return json({ error: "Falta el pedido" }, 400);
    if (!reason || reason.trim().length < 3) return json({ error: "Indicá un motivo de cancelación" }, 400);

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", order_id)
      .maybeSingle();

    if (error || !order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.user_id !== userId) return json({ error: "Este pedido no es tuyo" }, 403);
    if (order.status === "cancelled") return json({ error: "El pedido ya estaba cancelado" }, 409);
    if (!CANCELABLE.includes(order.status)) {
      return json({ error: `No se puede cancelar un pedido en estado "${order.status}"` }, 409);
    }

    await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    await supabase.from("order_status_history").insert({
      order_id,
      status: "cancelled",
      changed_by: "customer",
      reason: reason.trim(),
    });

    try {
      await supabase.functions.invoke("notify-vendor", {
        body: { orderId: order_id, eventType: "order_cancelled" },
      });
    } catch (_e) { /* no bloquear la cancelación por el aviso */ }

    return json({ success: true, order_id, status: "cancelled" });
  } catch (e) {
    console.error("cancelar-pedido error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
