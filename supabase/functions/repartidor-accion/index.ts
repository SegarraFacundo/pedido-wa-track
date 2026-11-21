// ============================================================
// repartidor-accion: el repartidor toma un reparto y avanza sus estados.
// Sincroniza orders.status cuando corresponde.
//   take → assigned · picked_up · delivering (orders=delivering) · delivered (orders=delivered) · release
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
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: courier } = await db.from("couriers").select("id, payout_fee, is_active").eq("user_id", callerId).maybeSingle();
    if (!courier) return json({ error: "No sos repartidor" }, 403);
    if (!courier.is_active) return json({ error: "Tu cuenta de repartidor está inactiva" }, 403);

    const { delivery_id, action } = (await req.json()) as { delivery_id?: string; action?: string };
    if (!delivery_id || !action) return json({ error: "Faltan datos" }, 400);

    const { data: d } = await db.from("deliveries").select("*").eq("id", delivery_id).maybeSingle();
    if (!d) return json({ error: "Reparto inexistente" }, 404);

    const now = new Date().toISOString();
    const owns = d.courier_id === courier.id;

    if (action === "take") {
      if (d.status !== "available") return json({ error: "Ese pedido ya fue tomado" }, 409);
      await db.from("deliveries").update({
        courier_id: courier.id, status: "assigned", assigned_at: now, fee: Number(courier.payout_fee) || 0,
      }).eq("id", d.id).eq("status", "available"); // guard anti-carrera
      return json({ success: true, status: "assigned" });
    }

    if (!owns) return json({ error: "Ese reparto no es tuyo" }, 403);

    if (action === "release") {
      await db.from("deliveries").update({ courier_id: null, status: "available", assigned_at: null }).eq("id", d.id);
      return json({ success: true, status: "available" });
    }
    if (action === "picked_up") {
      await db.from("deliveries").update({ status: "picked_up", picked_up_at: now }).eq("id", d.id);
      return json({ success: true, status: "picked_up" });
    }
    if (action === "delivering") {
      await db.from("deliveries").update({ status: "delivering" }).eq("id", d.id);
      await db.from("orders").update({ status: "delivering" }).eq("id", d.order_id);
      return json({ success: true, status: "delivering" });
    }
    if (action === "delivered") {
      await db.from("deliveries").update({ status: "delivered", delivered_at: now }).eq("id", d.id);
      await db.from("orders").update({ status: "delivered" }).eq("id", d.order_id);
      return json({ success: true, status: "delivered" });
    }

    return json({ error: "Acción inválida" }, 400);
  } catch (e) {
    console.error("repartidor-accion error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
