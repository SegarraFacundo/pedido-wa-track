// ============================================================
// order-courier-location: devuelve la ubicación del repartidor asignado a un
// pedido, sólo al cliente dueño del pedido y mientras el reparto está en curso.
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

    const { order_id } = (await req.json()) as { order_id?: string };
    if (!order_id) return json({ error: "Falta el pedido" }, 400);

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: order } = await db.from("orders").select("id, user_id").eq("id", order_id).maybeSingle();
    if (!order || order.user_id !== callerId) return json({ error: "No autorizado" }, 403);

    const { data: delivery } = await db
      .from("deliveries")
      .select("status, courier_id")
      .eq("order_id", order_id)
      .maybeSingle();
    if (!delivery || !delivery.courier_id || !["picked_up", "delivering"].includes(delivery.status)) {
      return json({ available: false });
    }

    const { data: courier } = await db
      .from("couriers")
      .select("name, current_lat, current_lng")
      .eq("id", delivery.courier_id)
      .maybeSingle();
    if (!courier || courier.current_lat == null || courier.current_lng == null) {
      return json({ available: false });
    }

    return json({
      available: true,
      status: delivery.status,
      name: courier.name,
      lat: Number(courier.current_lat),
      lng: Number(courier.current_lng),
    });
  } catch (e) {
    console.error("order-courier-location error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
