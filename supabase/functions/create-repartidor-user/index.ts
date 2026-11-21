// ============================================================
// create-repartidor-user: el admin da de alta un repartidor
// (crea el usuario de Auth, le asigna el rol 'repartidor' y crea la fila couriers).
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

    // ── Solo admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin");
    if (!roles || roles.length === 0) return json({ error: "Solo el admin puede crear repartidores" }, 403);

    const { email, password, name, phone, vehicle, payout_fee, monotributo_cuit } = await req.json();
    if (!email || !password || !name) return json({ error: "Faltan datos (email, contraseña, nombre)" }, 400);

    // Evitar perfil huérfano con ese email.
    await admin.from("profiles").delete().eq("email", email);

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "repartidor" },
      app_metadata: { provider: "email", providers: ["email"] },
    });
    if (userError || !userData.user) return json({ error: userError?.message || "No se pudo crear el usuario" }, 400);
    const userId = userData.user.id;

    await admin.from("profiles").insert({ id: userId, email, role: "repartidor" });
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role: "repartidor" });
    if (roleError && roleError.code !== "23505") console.error("role error:", roleError);

    const { error: courierError } = await admin.from("couriers").insert({
      user_id: userId,
      name,
      phone: phone || null,
      vehicle: vehicle || null,
      payout_fee: payout_fee != null ? Number(payout_fee) : 0,
      monotributo_cuit: monotributo_cuit || null,
    });
    if (courierError) return json({ error: courierError.message }, 400);

    return json({ success: true, userId });
  } catch (e) {
    console.error("create-repartidor-user error:", e);
    return json({ error: "Error interno" }, 500);
  }
});
