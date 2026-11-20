// ============================================================
// Edge function: calificar-pedido
// El cliente (autenticado) califica su pedido entregado (delivery/atención/producto + comentario).
// Porta la lógica de evolution-webhook/tool-handlers.ts (case "registrar_calificacion").
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

interface Body {
  order_id: string;
  delivery_rating?: number;
  service_rating?: number;
  product_rating?: number;
  comment?: string;
  customer_name?: string;
}

const clampStar = (n: unknown): number | null => {
  const v = Math.round(Number(n));
  return v >= 1 && v <= 5 ? v : null;
};

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

    const body = (await req.json()) as Body;
    if (!body.order_id) return json({ error: "Falta el pedido" }, 400);

    const delivery = clampStar(body.delivery_rating);
    const service = clampStar(body.service_rating);
    const product = clampStar(body.product_rating);
    const comment = (body.comment || "").trim() || null;

    if (!delivery && !service && !product && !comment) {
      return json({ error: "Dejá al menos una calificación o un comentario" }, 400);
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, user_id, vendor_id, status, customer_phone")
      .eq("id", body.order_id)
      .maybeSingle();

    if (error || !order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.user_id !== userId) return json({ error: "Este pedido no es tuyo" }, 403);
    if (order.status !== "delivered") return json({ error: "Sólo podés calificar un pedido entregado" }, 409);

    // Evitar reseñas duplicadas por pedido.
    const { data: existing } = await supabase
      .from("vendor_reviews")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing) return json({ error: "Ya calificaste este pedido", already_reviewed: true }, 409);

    const stars = [delivery, service, product].filter((r): r is number => r !== null);
    const average = stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length) : null;

    const { error: insertError } = await supabase.from("vendor_reviews").insert({
      vendor_id: order.vendor_id,
      order_id: order.id,
      customer_phone: order.customer_phone,
      customer_name: body.customer_name?.trim() || order.customer_phone,
      rating: average,
      delivery_rating: delivery,
      service_rating: service,
      product_rating: product,
      comment,
    });

    if (insertError) {
      console.error("Error guardando reseña:", insertError);
      return json({ error: "No se pudo guardar la reseña" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("calificar-pedido error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
