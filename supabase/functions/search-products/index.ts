import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Input validation ──
    const body = await req.json();
    const { searchQuery, vendorIds } = body;

    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0 || searchQuery.length > 200) {
      return new Response(
        JSON.stringify({ found: false, message: 'Search query must be 1-200 characters' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (vendorIds && (!Array.isArray(vendorIds) || vendorIds.some((id: any) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))) {
      return new Response(
        JSON.stringify({ found: false, message: 'Invalid vendor IDs format' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const sanitizedQuery = searchQuery.trim().substring(0, 200);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un asistente que normaliza búsquedas de comida. Corrige errores ortográficos y extrae las palabras clave correctas. Responde SOLO con las palabras clave corregidas separadas por comas."
          },
          {
            role: "user",
            content: `Normaliza esta búsqueda y corrige errores: "${sanitizedQuery}". 
            
Ejemplos:
- "piza" → "pizza"
- "pizzas" → "pizza"
- "hamburgueza" → "hamburguesa"
- "suchi" → "sushi"
- "quiero pedir 4 pizzas" → "pizza"

Responde solo con las palabras clave corregidas, sin explicación ni ejemplos.`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const keywords = aiData.choices[0].message.content.trim().toLowerCase();
    console.log("Keywords normalizadas:", keywords);

    const keywordArray = keywords.split(",").map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    
    if (keywordArray.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: `No pude entender qué buscas. Intenta con algo como "pizza" o "hamburguesa"` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const now = new Date();
    const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = daysOfWeek[argentinaTime.getDay()];
    const hours = String(argentinaTime.getHours()).padStart(2, '0');
    const minutes = String(argentinaTime.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    let allProducts: any[] = [];
    
    for (const keyword of keywordArray) {
      let query = supabase
        .from('products')
        .select(`id, name, description, price, category, image, vendor:vendors(id, name, category, average_rating, is_active, payment_status, days_open, opening_time, closing_time, vendor_hours(is_open_24_hours))`)
        .eq('is_available', true);
      
      query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,category.cs.{${keyword}}`);
      
      if (vendorIds && Array.isArray(vendorIds) && vendorIds.length > 0) {
        query = query.in('vendor_id', vendorIds);
      }
      
      const { data: products } = await query;
      if (products && products.length > 0) {
        allProducts = [...allProducts, ...products];
      }
    }

    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());

    if (uniqueProducts.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: `No encontré productos relacionados con "${searchQuery}"` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openProducts = uniqueProducts.filter((p: any) => {
      const vendor = p.vendor;
      if (!vendor || !vendor.is_active || vendor.payment_status !== 'active') return false;
      if (!vendor.days_open || !vendor.days_open.includes(dayOfWeek)) return false;

      const isOpen24Hours = vendor.vendor_hours?.some((h: any) => h.is_open_24_hours);
      if (isOpen24Hours) return true;

      if (vendor.opening_time && vendor.closing_time) {
        const openingTime = vendor.opening_time.substring(0, 5);
        const closingTime = vendor.closing_time.substring(0, 5);
        if (currentTime < openingTime || currentTime > closingTime) return false;
      }
      return true;
    });

    if (openProducts.length === 0) {
      const msg = uniqueProducts.length > 0
        ? `Encontré productos de "${searchQuery}", pero ningún negocio está abierto ahora.`
        : `No encontré productos relacionados con "${searchQuery}".`;
      return new Response(
        JSON.stringify({ found: false, message: msg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendorMap = new Map();
    openProducts.forEach((p: any) => {
      const vendorId = p.vendor.id;
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, { vendor: p.vendor, products: [] });
      }
      vendorMap.get(vendorId).products.push({ id: p.id, name: p.name, description: p.description, price: p.price, category: p.category });
    });

    const results = Array.from(vendorMap.values());

    return new Response(
      JSON.stringify({ found: true, results, totalProducts: openProducts.length, totalVendors: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en search-products:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
