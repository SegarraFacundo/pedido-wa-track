// ============================================================
// Edge function: send-push
// Envía una notificación web-push al cliente dueño de un pedido (incluso con la app cerrada).
// La dispara el panel del vendedor (o el bot) al cambiar el estado del pedido.
// Requiere los secrets VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STATUS_MSG: Record<string, string> = {
  confirmed: "Tu pedido fue confirmado ✅",
  preparing: "Tu pedido se está preparando 👨‍🍳",
  ready: "Tu pedido está listo 🎉",
  delivering: "Tu pedido va en camino 🛵",
  delivered: "Tu pedido fue entregado. ¡Que lo disfrutes! 😋",
  cancelled: "Tu pedido fue cancelado",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    if (!vapidPublic || !vapidPrivate) return json({ error: "VAPID keys no configuradas" }, 500);

    webpush.setVapidDetails("mailto:soporte@lapacho.ar", vapidPublic, vapidPrivate);

    const supabase = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { order_id, title, body } = (await req.json()) as {
      order_id?: string; title?: string; body?: string;
    };
    if (!order_id) return json({ error: "Falta el pedido" }, 400);

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", order_id)
      .maybeSingle();
    if (!order || !order.user_id) return json({ error: "Pedido sin usuario o inexistente" }, 404);

    const message = body || STATUS_MSG[order.status] || "Tu pedido tuvo una actualización";

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", order.user_id);

    if (!subs || subs.length === 0) return json({ success: true, sent: 0, note: "sin suscripciones" });

    const payload = JSON.stringify({
      title: title || "Lapacho",
      body: message,
      icon: "https://lapacho.ar/lapacho-icon.png",
      badge: "https://lapacho.ar/lapacho-icon.png",
      url: `/pedido/${order_id}`,
    });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        // 404/410 => suscripción vencida: la borramos
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("Error enviando push:", code, e?.body || e);
        }
      }
    }

    return json({ success: true, sent });
  } catch (e) {
    console.error("send-push error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
