// ============================================================
// Edge function: contactar-soporte
// El cliente (autenticado) abre un ticket de soporte con asunto + descripción.
// Porta la lógica de evolution-webhook/tool-handlers.ts (case "crear_ticket_soporte").
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

    const { subject, message, customer_phone, customer_name } = (await req.json()) as {
      subject?: string; message?: string; customer_phone?: string; customer_name?: string;
    };
    if (!subject || subject.trim().length < 3) return json({ error: "Escribí un asunto" }, 400);
    if (!message || message.trim().length < 5) return json({ error: "Describí tu consulta" }, 400);
    const phone = (customer_phone || "").trim();
    if (!phone) return json({ error: "Falta un teléfono de contacto" }, 400);

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        customer_phone: phone,
        customer_name: customer_name?.trim() || phone,
        subject: subject.trim(),
        priority: "normal",
        status: "open",
      })
      .select("id")
      .single();

    if (error || !ticket) {
      console.error("Error creando ticket:", error);
      return json({ error: "No se pudo crear el ticket" }, 500);
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_type: "customer",
      message: message.trim(),
    });

    return json({ success: true, ticket_id: ticket.id });
  } catch (e) {
    console.error("contactar-soporte error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
