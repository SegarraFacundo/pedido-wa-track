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
    const { searchQuery } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Usar IA para extraer palabras clave de búsqueda
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
            content: "Eres un asistente que extrae palabras clave de búsqueda de productos de comida. Responde solo con las palabras clave separadas por comas, sin explicaciones."
          },
          {
            role: "user",
            content: `Del texto "${searchQuery}", extrae las palabras clave para buscar productos de comida. Por ejemplo, si dice "quiero una pizza con pepperoni", responde "pizza, pepperoni". Si dice "hamburguesa completa", responde "hamburguesa". Solo palabras clave, sin artículos ni palabras innecesarias.`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const keywords = aiData.choices[0].message.content.trim().toLowerCase();
    console.log("Keywords extraídas:", keywords);

    // Buscar productos que coincidan con las keywords
    const keywordArray = keywords.split(",").map((k: string) => k.trim());
    
    // Obtener hora actual y día de la semana
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toTimeString().split(' ')[0];

    // Buscar productos y vendors abiertos
    let productsQuery = supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        category,
        vendor:vendors(
          id,
          name,
          category,
          average_rating,
          is_active,
          payment_status,
          days_open,
          opening_time,
          closing_time
        )
      `)
      .eq('is_available', true);

    // Filtrar por palabras clave
    const orConditions = keywordArray.map(kw => `name.ilike.%${kw}%,description.ilike.%${kw}%,category.ilike.%${kw}%`).join(',');
    productsQuery = productsQuery.or(orConditions);

    const { data: products, error } = await productsQuery;

    if (error) {
      console.error("Error buscando productos:", error);
      throw error;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: `No encontré productos relacionados con "${searchQuery}"` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filtrar vendors abiertos
    const openProducts = products.filter((p: any) => {
      const vendor = p.vendor;
      if (!vendor || !vendor.is_active || vendor.payment_status !== 'active') {
        return false;
      }

      // Verificar si está abierto hoy
      if (!vendor.days_open || !vendor.days_open.includes(dayOfWeek)) {
        return false;
      }

      // Verificar horario
      if (vendor.opening_time && vendor.closing_time) {
        if (currentTime < vendor.opening_time || currentTime > vendor.closing_time) {
          return false;
        }
      }

      return true;
    });

    if (openProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: `Encontré productos, pero ningún negocio está abierto en este momento` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupar por vendor
    const vendorMap = new Map();
    openProducts.forEach((p: any) => {
      const vendorId = p.vendor.id;
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendor: p.vendor,
          products: []
        });
      }
      vendorMap.get(vendorId).products.push({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category
      });
    });

    const results = Array.from(vendorMap.values());

    return new Response(
      JSON.stringify({ 
        found: true, 
        results,
        totalProducts: openProducts.length,
        totalVendors: results.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en search-products:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
