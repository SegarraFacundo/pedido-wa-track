// ============================================================
// repartidor-feed: para el repartidor autenticado, devuelve su perfil,
// los repartos disponibles (pool), el reparto activo y stats del día.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SEL =
  "id, status, fee, order_id, orders(id, address, total, items, customer_phone, customer_name, notes, created_at, delivery_type, vendors(name, address, phone))";

function shape(d: any) {
  const o = d.orders || {};
  const v = o.vendors || {};
  return {
    delivery_id: d.id,
    status: d.status,
    fee: Number(d.fee) || 0,
    order: {
      id: o.id,
      address: o.address,
      total: Number(o.total) || 0,
      items: o.items || [],
      phone: o.customer_phone,
      name: o.customer_name,
      notes: o.notes || null,
      created_at: o.created_at,
      delivery_type: o.delivery_type,
    },
    vendor: { name: v.name || "", address: v.address || "", phone: v.phone || "" },
  };
}

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

    const { data: courier } = await db
      .from("couriers")
      .select("id, name, is_online, is_active, payout_fee")
      .eq("user_id", callerId)
      .maybeSingle();
    if (!courier) return json({ error: "No sos repartidor" }, 403);

    const [{ data: avail }, { data: act }] = await Promise.all([
      db.from("deliveries").select(SEL).eq("status", "available").order("created_at", { ascending: true }),
      db
        .from("deliveries")
        .select(SEL)
        .eq("courier_id", courier.id)
        .in("status", ["assigned", "picked_up", "delivering"])
        .order("created_at", { ascending: true }),
    ]);

    // Stats del día (entregas y ganancias).
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: done } = await db
      .from("deliveries")
      .select("fee")
      .eq("courier_id", courier.id)
      .eq("status", "delivered")
      .gte("delivered_at", since.toISOString());
    const todayCount = done?.length ?? 0;
    const todayEarnings = (done ?? []).reduce((s: number, d: any) => s + (Number(d.fee) || 0), 0);

    return json({
      courier: { id: courier.id, name: courier.name, is_online: courier.is_online, is_active: courier.is_active, payout_fee: Number(courier.payout_fee) || 0 },
      available: (avail ?? []).map(shape),
      active: (act ?? []).map(shape),
      today: { count: todayCount, earnings: todayEarnings },
    });
  } catch (e) {
    console.error("repartidor-feed error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
