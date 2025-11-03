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
    const { searchQuery, vendorIds } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Usar IA para extraer y normalizar palabras clave de búsqueda
    // La IA también corrige errores ortográficos y genera variaciones
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
            content: `Normaliza esta búsqueda y corrige errores: "${searchQuery}". 
            
Ejemplos:
- "piza" → "pizza"
- "pizzas" → "pizza"
- "pzzas" → "pizza"
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
    console.log("Keywords normalizadas:", keywords, "desde búsqueda original:", searchQuery);

    // Buscar productos que coincidan con las keywords (con búsqueda flexible)
    const keywordArray = keywords.split(",").map((k: string) => k.trim()).filter(k => k.length > 0);
    
    if (keywordArray.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: `No pude entender qué buscas. Intenta con algo como "pizza" o "hamburguesa"` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Obtener día de la semana actual en formato correcto (monday, tuesday, etc.)
    // Usar zona horaria de Argentina
    const now = new Date();
    const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = daysOfWeek[argentinaTime.getDay()];
    const hours = String(argentinaTime.getHours()).padStart(2, '0');
    const minutes = String(argentinaTime.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`; // HH:MM format
    
    console.log("Día actual (Argentina):", dayOfWeek, "Hora actual (Argentina):", currentTime);

    // Buscar productos con búsqueda flexible
    // Para cada keyword, buscar con wildcards generosos
    let allProducts: any[] = [];
    
    for (const keyword of keywordArray) {
      // Buscar en nombre, descripción y categoría
      // Usar % en ambos lados para buscar la palabra en cualquier parte
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          category,
          image,
          vendor:vendors(
            id,
            name,
            category,
            average_rating,
            is_active,
            payment_status,
            days_open,
            opening_time,
            closing_time,
            vendor_hours(is_open_24_hours)
          )
        `)
        .eq('is_available', true)
        .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,category.ilike.%${keyword}%`);
      
      // Si se proporcionan vendorIds, filtrar solo esos vendors
      if (vendorIds && Array.isArray(vendorIds) && vendorIds.length > 0) {
        query = query.in('vendor_id', vendorIds);
      }
      
      const { data: products } = await query;
      
      if (products && products.length > 0) {
        allProducts = [...allProducts, ...products];
      }
    }

    // Eliminar duplicados por ID de producto
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.id, p])).values()
    );

    const products = uniqueProducts;
    const error = null;

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
        console.log(`Vendor ${vendor?.name} filtrado: is_active=${vendor?.is_active}, payment_status=${vendor?.payment_status}`);
        return false;
      }

      // Verificar si está abierto hoy
      if (!vendor.days_open || !vendor.days_open.includes(dayOfWeek)) {
        console.log(`Vendor ${vendor.name} cerrado hoy. days_open:`, vendor.days_open, "día actual:", dayOfWeek);
        return false;
      }

      // Verificar si está abierto 24 horas
      const isOpen24Hours = vendor.vendor_hours?.some((h: any) => h.is_open_24_hours);
      
      if (isOpen24Hours) {
        console.log(`Vendor ${vendor.name} está abierto 24 horas`);
        return true;
      }

      // Verificar horario (si tiene horarios definidos)
      if (vendor.opening_time && vendor.closing_time) {
        const openingTime = vendor.opening_time.substring(0, 5); // HH:MM
        const closingTime = vendor.closing_time.substring(0, 5); // HH:MM
        
        if (currentTime < openingTime || currentTime > closingTime) {
          console.log(`Vendor ${vendor.name} fuera de horario. Horario: ${openingTime}-${closingTime}, Actual (Argentina): ${currentTime}`);
          return false;
        }
      }

      console.log(`Vendor ${vendor.name} está abierto y disponible`);
      return true;
    });

    if (openProducts.length === 0) {
      // Verificar si había productos pero ningún vendor está abierto
      if (products.length > 0) {
        return new Response(
          JSON.stringify({ 
            found: false, 
            message: `Encontré productos de "${searchQuery}", pero ningún negocio está abierto ahora. Intenta más tarde o busca otra cosa.` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: `No encontré productos relacionados con "${searchQuery}". Intenta con: pizza, hamburguesa, sushi, empanadas, etc.` 
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
