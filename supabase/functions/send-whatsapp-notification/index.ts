import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeArgentinePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/(:\d+)?@[\w.]+$/i, "");
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, "").replace(/[^\d]/g, "");

  if (/^54993/.test(cleaned) && cleaned.length === 14) {
    cleaned = "549" + cleaned.substring(4);
  }
  if (cleaned.startsWith("549") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("54") && !cleaned.startsWith("549") && cleaned.length === 12) {
    cleaned = "549" + cleaned.substring(2);
  }
  if (cleaned.startsWith("9") && cleaned.length === 11) {
    cleaned = "54" + cleaned;
  }
  if (!cleaned.startsWith("54") && cleaned.length === 10) {
    cleaned = "549" + cleaned;
  }
  if (cleaned.length > 13) {
    cleaned = "549" + cleaned.slice(-10);
  }
  return cleaned;
}

function buildChatId(raw: string, normalized: string): string {
  if (raw?.includes("@lid") || raw?.includes(":")) {
    const chatId = raw.replace(/(:\d+)?@lid$/, "@s.whatsapp.net");
    return chatId;
  }
  return `${normalized}@s.whatsapp.net`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Allow service_role OR authenticated vendor/admin
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── Input validation ──
    const { orderId, message, phoneNumber } = await req.json();

    if (orderId && (typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId))) {
      return new Response(JSON.stringify({ error: 'Invalid orderId format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!message || typeof message !== 'string' || message.length > 4096) {
      return new Response(JSON.stringify({ error: 'Message is required and must be under 4096 chars' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("📨 WhatsApp notification request:", { orderId, phoneNumber: '***' });

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error("Evolution API credentials not configured");
    }

    const normalizedPhone = normalizeArgentinePhone(phoneNumber);
    const chatId = buildChatId(phoneNumber, normalizedPhone);

    const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionApiKey,
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "SupabaseFunction/1.0"
      },
      body: JSON.stringify({ number: chatId, text: message }),
    });

    const evolutionResponse = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: evolutionResponse.message || "No se pudo enviar por WhatsApp" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: evolutionResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("💥 Error in send-whatsapp-notification:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
