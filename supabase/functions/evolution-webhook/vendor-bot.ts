import OpenAI from "https://esm.sh/openai@4.77.3";
import type { ConversationContext, CartItem } from "./types.ts";
import { getPendingStateForPayment } from "./types.ts";
import { normalizeArgentinePhone } from "./utils.ts";
import { getContext, saveContext } from "./context.ts";
import { tools } from "./tools-definitions.ts";
import { buildSystemPrompt } from "./simplified-prompt.ts";

// ==================== HELPER: REAL-TIME VENDOR CONFIG ====================

// ✅ SIEMPRE consulta la DB para obtener la configuración actual del vendor
// NUNCA usa valores cacheados del contexto para allows_pickup/allows_delivery
async function getVendorConfig(vendorId: string, supabase: any) {
  const { data, error } = await supabase
    .from("vendors")
    .select("allows_pickup, allows_delivery, pickup_instructions, address, is_active, name")
    .eq("id", vendorId)
    .single();
  
  if (error) {
    console.error(`❌ Error fetching vendor config for ${vendorId}:`, error);
  }
  
  return {
    allows_pickup: data?.allows_pickup === true,
    allows_delivery: data?.allows_delivery ?? true, // Default true si no existe
    pickup_instructions: data?.pickup_instructions,
    address: data?.address,
    is_active: data?.is_active ?? true,
    name: data?.name
  };
}

// ==================== EJECUTORES DE HERRAMIENTAS ====================

async function ejecutarHerramienta(
  toolName: string,
  args: any,
  context: ConversationContext,
  supabase: any,
): Promise<string> {
  console.log(`🔧 [TOOL CALL] ${toolName}`, JSON.stringify(args, null, 2));
  console.log(`Ejecutando herramienta: ${toolName}`, args);

  try {
    switch (toolName) {
      case "buscar_productos": {
        // 🔄 STATE TRANSITION: idle/browsing → browsing
        const oldState = context.order_state || "idle";
        context.order_state = "browsing";
        console.log(`🔄 STATE: ${oldState} → browsing (buscar_productos)`);
        await saveContext(context, supabase);

        // Si el usuario tiene ubicación, usar función de filtrado por radio
        if (context.user_latitude && context.user_longitude) {
          console.log(`📍 User has location, filtering by delivery radius`);

          // Primero obtener vendors en rango
          const { data: vendorsInRange, error: rangeError } = await supabase.rpc("get_vendors_in_range", {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          });

          if (rangeError) {
            console.error("Error getting vendors in range:", rangeError);
          }

          if (!vendorsInRange || vendorsInRange.length === 0) {
            return `😔 No encontré negocios que hagan delivery a tu ubicación con "${args.consulta}".\n\n💡 Tip: Si te moviste de zona, podés compartir tu nueva ubicación usando el botón 📍 de WhatsApp.`;
          }

          // Filtrar solo los vendor IDs que están en rango
          const vendorIdsInRange = vendorsInRange.map((v: any) => v.vendor_id);

          // Buscar productos solo en esos vendors
          const { data: searchResults, error: searchError } = await supabase.functions.invoke("search-products", {
            body: {
              searchQuery: args.consulta,
              vendorIds: vendorIdsInRange, // Filtrar por vendors en rango
            },
          });

          if (searchError || !searchResults?.found) {
            return `No encontré productos de "${args.consulta}" en negocios que lleguen a tu zona.\n\nPodés buscar otra cosa o ver todos los locales disponibles diciendo "ver locales".`;
          }

          // Formatear resultados con distancia
          let resultado = `Encontré ${searchResults.totalVendors} negocios cerca tuyo con ${searchResults.totalProducts} productos:\n\n`;
          searchResults.results.forEach((r: any, i: number) => {
            const vendorDistance = vendorsInRange.find((v: any) => v.vendor_id === r.vendor.id);
            resultado += `${i + 1}. ${r.vendor.name}`;
            if (vendorDistance) {
              resultado += ` (${vendorDistance.distance_km.toFixed(1)} km)`;
            }
            resultado += `\n`;
            resultado += `   ID: ${r.vendor.id}\n`;
            resultado += `   Rating: ${r.vendor.average_rating || "N/A"}⭐\n`;
            resultado += `   Productos disponibles:\n`;
            r.products.forEach((p: any, j: number) => {
              resultado += `     ${j + 1}. ${p.name} - $${p.price}\n`;
              resultado += `        ID: ${p.id}\n`;
            });
            resultado += `\n`;
          });

          return resultado;
        } else {
          // Sin ubicación, búsqueda normal pero informar al usuario
          const { data, error } = await supabase.functions.invoke("search-products", {
            body: { searchQuery: args.consulta },
          });

          console.log("Search products result:", JSON.stringify(data, null, 2));

          if (error || !data?.found) {
            return `No encontré negocios abiertos con "${args.consulta}".\n\n💡 Tip: Si compartís tu ubicación 📍, te puedo mostrar solo los negocios que hacen delivery a tu zona.`;
          }

          // Formatear resultados
          let resultado = `Encontré ${data.totalVendors} negocios con ${data.totalProducts} productos:\n\n⚠️ *Nota:* Sin tu ubicación, te muestro todos los negocios. Para ver solo los que te entregan, compartí tu ubicación 📍.\n\n`;
          data.results.forEach((r: any, i: number) => {
            resultado += `${i + 1}. ${r.vendor.name}\n`;
            resultado += `   ID: ${r.vendor.id}\n`;
            resultado += `   Rating: ${r.vendor.average_rating || "N/A"}⭐\n`;
            resultado += `   Productos disponibles:\n`;
            r.products.forEach((p: any, j: number) => {
              resultado += `     ${j + 1}. ${p.name} - $${p.price}\n`;
              resultado += `        ID: ${p.id}\n`;
            });
            resultado += `\n`;
          });

          return resultado;
        }
      }

      case "ver_locales_abiertos": {
        // 🚫 Validar que no haya pedido activo
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }
        
        // 🕒 Hora local en Argentina
        const now = new Date();
        const argentinaTime = new Date(
          now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
        );
        const currentDay = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][argentinaTime.getDay()];
        console.log(`🕐 Día actual: ${currentDay}`);

        // 📍 Comprobamos si el usuario tiene ubicación
        if (!context.user_latitude || !context.user_longitude) {
          return "📍 Para ver negocios cercanos, primero compartí tu ubicación.";
        }

        // 🔎 Pedimos la lista de negocios dentro del radio de entrega
        const { data: vendorsInRange, error } = await supabase.rpc(
          "get_vendors_in_range",
          {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          }
        );

        if (error) {
          console.error("Error get_vendors_in_range:", error);
          return "⚠️ Ocurrió un error al buscar negocios cercanos. Intentalo nuevamente.";
        }

        if (!vendorsInRange || vendorsInRange.length === 0) {
          return "😔 No hay negocios que hagan delivery a tu ubicación en este momento.";
        }

        // 📋 Obtenemos todos los vendor_id para consultar horarios
        const vendorIds = vendorsInRange.map((v: any) => v.vendor_id);
        const { data: vendorHours, error: hoursError } = await supabase
          .from("vendor_hours")
          .select(
            "vendor_id, day_of_week, opening_time, closing_time, is_closed, is_open_24_hours"
          )
          .in("vendor_id", vendorIds)
          .eq("day_of_week", currentDay);

        if (hoursError) console.error("Error obteniendo horarios:", hoursError);

        // 🔁 Creamos un mapa vendor_id → horarios
        const hoursMap = new Map();
        vendorHours?.forEach((h) => {
          if (!hoursMap.has(h.vendor_id)) hoursMap.set(h.vendor_id, []);
          hoursMap.get(h.vendor_id).push(h);
        });

        // 📋 Obtener información detallada de todos los vendors
        console.log("📋 Vendor IDs to fetch:", vendorIds);
        const { data: vendorsInfo, error: vendorsInfoError } = await supabase
          .from("vendors")
          .select("id, address, average_rating, total_reviews")
          .in("id", vendorIds);

        if (vendorsInfoError) console.error("Error obteniendo info vendors:", vendorsInfoError);
        console.log("📋 Vendors info fetched:", JSON.stringify(vendorsInfo, null, 2));

        // 🗺️ Crear mapa vendor_id → información
        const vendorsInfoMap = new Map();
        vendorsInfo?.forEach((vi) => {
          vendorsInfoMap.set(vi.id, vi);
          console.log(`  Mapped vendor ${vi.id}: ${vi.address}`);
        });

        // 🟢 y 🔴 Separar abiertos y cerrados
        const openVendors = vendorsInRange.filter((v: any) => v.is_open);
        const closedVendors = vendorsInRange.filter((v: any) => !v.is_open);

        let resultado = "¡Aquí tenés los negocios abiertos que hacen delivery a tu zona! 🚗\n\n";

        // Almacenar mapa de vendors disponibles (para búsqueda posterior sin mostrar UUIDs)
        const vendorMap: Array<{ index: number; name: string; vendor_id: string }> = [];
        let currentIndex = 1;

        // 🟢 ABIERTOS
        if (openVendors.length > 0) {
          resultado += `🟢 *ABIERTOS AHORA* (${openVendors.length}):\n\n`;
          openVendors.forEach((v: any, i: number) => {
            resultado += `${currentIndex}. *${v.vendor_name}*\n`;

            // Dirección y distancia
            const vendorInfo = vendorsInfoMap.get(v.vendor_id);
            console.log(`🔍 Looking for vendor ${v.vendor_id}, found:`, vendorInfo);
            resultado += `📍 ${vendorInfo?.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            
            // Guardar en el mapa (NO mostrar ID al usuario)
            vendorMap.push({ index: currentIndex, name: v.vendor_name, vendor_id: v.vendor_id });
            currentIndex++;

            // Mostrar horario real desde vendor_hours
            const todayHours = hoursMap.get(v.vendor_id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            } else {
              resultado += `⏰ Horario: No disponible\n`;
            }

            // Rating si existe
            if (vendorInfo?.average_rating && vendorInfo?.total_reviews)
              resultado += `⭐ Rating: ${vendorInfo.average_rating.toFixed(1)} (${vendorInfo.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        // 🔴 CERRADOS
        if (closedVendors.length > 0) {
          resultado += `🔴 *CERRADOS* (${closedVendors.length}):\n\n`;
          closedVendors.forEach((v: any, i: number) => {
            resultado += `${currentIndex}. *${v.vendor_name}* 🔒\n`;

            const vendorInfo = vendorsInfoMap.get(v.vendor_id);
            resultado += `📍 ${vendorInfo?.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            
            // Guardar en el mapa (NO mostrar ID al usuario)
            vendorMap.push({ index: currentIndex, name: v.vendor_name, vendor_id: v.vendor_id });
            currentIndex++;

            // Mostrar horario real
            const todayHours = hoursMap.get(v.vendor_id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            } else {
              resultado += `⏰ Horario: No disponible\n`;
            }

            // Rating si existe
            if (vendorInfo?.average_rating && vendorInfo?.total_reviews)
              resultado += `⭐ Rating: ${vendorInfo.average_rating.toFixed(1)} (${vendorInfo.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        // Guardar el mapa en el contexto
        context.available_vendors_map = vendorMap;
        await saveContext(context, supabase);

        resultado +=
          "\n💬 Decime el *número* o *nombre* del negocio para ver su menú. 😊";

        return resultado;
      }


      case "ver_menu_negocio": {
        console.log(`🔍 ========== VER MENU NEGOCIO ==========`);
        console.log(`📝 Args vendor_id: "${args.vendor_id}"`);

        // 🚫 Validar que no haya pedido activo
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }

        // 🔄 STATE VALIDATION: Debe estar en browsing o viewing_menu
        const currentState = context.order_state || "idle";
        if (currentState === "idle") {
          context.order_state = "browsing";
          await saveContext(context, supabase);
        }

        // ⚠️ NOTA: Ya NO limpiamos automáticamente el carrito aquí
        // El bot debe preguntar primero al usuario si quiere cancelar su pedido actual
        // y solo después llamar a vaciar_carrito explícitamente

        // Búsqueda robusta de vendor con múltiples estrategias
        const searchVendor = async (searchTerm: string) => {
          // 0. PRIORIDAD: Buscar en el mapa de vendors disponibles (contexto)
          if (context.available_vendors_map && context.available_vendors_map.length > 0) {
            console.log("🔍 Buscando en mapa de vendors disponibles:", context.available_vendors_map.length);
            
            // 0a. Si es un número (ej: "1", "2"), buscar por índice
            const indexNum = parseInt(searchTerm);
            if (!isNaN(indexNum)) {
              const byIndex = context.available_vendors_map.find(v => v.index === indexNum);
              if (byIndex) {
                console.log(`✅ Vendor encontrado por índice ${indexNum}:`, byIndex.name);
                // Buscar el vendor completo en BD por ID
                const { data } = await supabase.from("vendors")
                  .select("id, name, is_active, payment_status")
                  .eq("id", byIndex.vendor_id)
                  .maybeSingle();
                if (data) return data;
              }
            }
            
            // 0b. Buscar por nombre parcial en el mapa
            const normalized = searchTerm.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[_-]/g, " ");
            
            const byName = context.available_vendors_map.find(v => {
              const vNorm = v.name.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return vNorm.includes(normalized) || normalized.includes(vNorm);
            });
            
            if (byName) {
              console.log(`✅ Vendor encontrado en mapa por nombre:`, byName.name);
              const { data } = await supabase.from("vendors")
                .select("id, name, is_active, payment_status")
                .eq("id", byName.vendor_id)
                .maybeSingle();
              if (data) return data;
            }
          }
          
          // 1. Si es un UUID válido, búsqueda directa
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(searchTerm)) {
            console.log("🔍 Búsqueda por UUID:", searchTerm);
            const { data } = await supabase.from("vendors")
              .select("id, name, is_active, payment_status")
              .eq("id", searchTerm).maybeSingle();
            if (data) {
              console.log("✅ Vendor encontrado por UUID:", data.name);
              return data;
            }
          }
          
          // 2. Limpiar y búsqueda exacta con ILIKE
          const cleaned = searchTerm.replace(/[-_]/g, " ").trim();
          console.log("🔍 Búsqueda exacta con:", cleaned);
          
          let { data } = await supabase.from("vendors")
            .select("id, name, is_active, payment_status")
            .ilike("name", `%${cleaned}%`)
            .eq("is_active", true)
            .maybeSingle();
          if (data) {
            console.log("✅ Vendor encontrado por coincidencia exacta:", data.name);
            return data;
          }
          
          // 3. Normalizar acentos manualmente como fallback
          console.log("🔍 Búsqueda con normalización de acentos");
          const normalized = cleaned
            .replace(/[áàäâã]/gi, 'a')
            .replace(/[éèëê]/gi, 'e')
            .replace(/[íìïî]/gi, 'i')
            .replace(/[óòöôõ]/gi, 'o')
            .replace(/[úùüû]/gi, 'u')
            .replace(/[ñ]/gi, 'n')
            .toLowerCase();
          
          // Buscar en todos los vendors activos y normalizar nombres
          const { data: allVendors } = await supabase.from("vendors")
            .select("id, name, is_active, payment_status")
            .eq("is_active", true);
          
          const found = allVendors?.find(v => {
            const vendorNormalized = v.name
              .replace(/[áàäâã]/gi, 'a')
              .replace(/[éèëê]/gi, 'e')
              .replace(/[íìïî]/gi, 'i')
              .replace(/[óòöôõ]/gi, 'o')
              .replace(/[úùüû]/gi, 'u')
              .replace(/[ñ]/gi, 'n')
              .toLowerCase();
            return vendorNormalized.includes(normalized);
          });
          
          if (found) {
            console.log("✅ Vendor encontrado por normalización:", found.name);
          }
          return found;
        };

        const vendor = await searchVendor(args.vendor_id);
        
        if (!vendor) {
          console.log(`❌ Vendor not found: ${args.vendor_id}`);
          return "No encontré ese negocio. Por favor usá el ID exacto que te mostré en la lista de locales abiertos.";
        }
        
        const vendorId = vendor.id;

        console.log(`✅ Vendor found: ${vendor.id} (${vendor.name}) - Active: ${vendor.is_active}, Payment: ${vendor.payment_status}`);

        // ✅ VALIDACIÓN: ¿Hay carrito activo de OTRO negocio?
        if (context.cart.length > 0 && 
            context.selected_vendor_id && 
            context.selected_vendor_id !== vendor.id) {
          
          console.log(`⚠️ User trying to change vendor with active cart`);
          console.log(`   Current vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);
          console.log(`   New vendor: ${vendor.name} (${vendor.id})`);
          console.log(`   Cart items: ${context.cart.length}`);
          
          // Guardar el cambio pendiente (pero NO cambiar el estado)
          context.pending_vendor_change = {
            new_vendor_id: vendor.id,
            new_vendor_name: vendor.name
          };
          
          // Mantener el estado en "shopping" - el cambio se confirmará después
          await saveContext(context, supabase);
          
          const currentTotal = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
          
          // ✅ MENSAJE MEJORADO - Mostrar productos actuales
          return `⚠️ *¡Atención!*\n\n` +
                 `Tenés ${context.cart.length} producto(s) en el carrito de *${context.selected_vendor_name}*:\n\n` +
                 context.cart.map((item, i) => 
                   `${i + 1}. ${item.product_name} x${item.quantity}`
                 ).join('\n') +
                 `\n\n💰 Total actual: $${currentTotal}\n\n` +
                 `Si querés ver el menú de *${vendor.name}*, voy a tener que *vaciar tu carrito actual*.\n\n` +
                 `¿Querés cambiar de negocio?\n\n` +
                 `✅ Escribe *"sí"* para vaciar el carrito y cambiar a ${vendor.name}\n` +
                 `❌ Escribe *"no"* para seguir con tu pedido de ${context.selected_vendor_name}`;
        }

        // Guardar el negocio seleccionado (siempre UUID real)
        context.selected_vendor_id = vendor.id;
        context.selected_vendor_name = vendor.name;
        console.log(`💾 Context updated - Vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);
        // NO limpiamos el carrito aquí - debe hacerse con vaciar_carrito explícitamente

        // Buscar productos del negocio - LOG DETALLADO
        console.log(`🛍️ Fetching products for vendor_id: ${vendor.id}`);
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("*")
          .eq("vendor_id", vendor.id)
          .eq("is_available", true);

        if (productsError) {
          console.error(`❌ Error fetching products:`, productsError);
          return `Hubo un error al buscar los productos de "${vendor.name}". Por favor intentá de nuevo.`;
        }

        console.log(`📦 Products found: ${products?.length || 0}`);
        
        if (!products || products.length === 0) {
          console.log(`⚠️ No products available for vendor: ${vendor.name} (${vendor.id})`);
          return `${vendor.name} no tiene productos disponibles en este momento. 😔\n\nPodés buscar otros negocios con productos disponibles.`;
        }

        // ⭐ Obtener información de delivery y pickup del vendor
        const { data: vendorDetails } = await supabase
          .from("vendors")
          .select("allows_pickup, allows_delivery, pickup_instructions, address")
          .eq("id", vendor.id)
          .single();
        
        if (vendorDetails) {
          context.vendor_allows_pickup = vendorDetails.allows_pickup === true;
          context.vendor_allows_delivery = vendorDetails.allows_delivery ?? true; // Default true si no está definido
          context.pickup_instructions = vendorDetails.pickup_instructions;
          console.log(`✅ Delivery options: allows_delivery=${context.vendor_allows_delivery}, allows_pickup=${context.vendor_allows_pickup}`);
        } else {
          context.vendor_allows_pickup = false;
          context.vendor_allows_delivery = true; // Default true
        }

        let menu = `📋 *Menú de ${vendor.name}*\n\n`;
        
        // ⭐ Mostrar opciones de entrega disponibles
        if (context.vendor_allows_delivery && context.vendor_allows_pickup) {
          menu += `✅ Opciones: *Delivery* y *Retiro en local*\n`;
          menu += `📍 Dirección: ${vendorDetails?.address || 'No disponible'}\n\n`;
        } else if (context.vendor_allows_pickup && !context.vendor_allows_delivery) {
          menu += `🏪 Este negocio solo acepta *retiro en local*\n`;
          menu += `📍 Dirección: ${vendorDetails?.address || 'No disponible'}\n\n`;
        } else if (context.vendor_allows_delivery && !context.vendor_allows_pickup) {
          menu += `🚚 Este negocio solo hace *delivery*\n\n`;
        }
        
        menu += `📦 Productos disponibles:\n\n`;
        for (const [i, p] of products.entries()) {
          menu += `${i + 1}. *${p.name}* - $${Math.round(p.price).toLocaleString("es-PY")}\n`;
          if (p.category) menu += `   🏷️ ${Array.isArray(p.category) ? p.category.join(", ") : p.category}\n`;
          if (p.description) menu += `   📝 ${p.description}\n`;
          menu += `\n`;
        }

        console.log(`✅ Menu generated successfully with ${products.length} products`);
        
        // 🚀 STATE TRANSITION: browsing → shopping
        const oldState = context.order_state || "idle";
        context.order_state = "shopping";
        console.log(`🔄 STATE TRANSITION: ${oldState} → shopping (menu shown, ready to shop)`);

        // 💾 IMPORTANTE: Guardar el contexto después de seleccionar el negocio
        await saveContext(context, supabase);
        console.log(`💾 Context saved with vendor: ${vendor.name} (${vendor.id})`);
        
        return menu;
      }

      case "agregar_al_carrito": {
        // 🚫 Validar que no haya pedido activo
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }
        
        const items = args.items as CartItem[];
        console.log("🛒 ========== AGREGAR AL CARRITO ==========");
        console.log("📦 Items to add:", JSON.stringify(items, null, 2));
        console.log("🔍 Context state:", {
          order_state: context.order_state,
          selected_vendor_id: context.selected_vendor_id,
          selected_vendor_name: context.selected_vendor_name,
          cart_items: context.cart.length,
        });

        // 🔒 STATE VALIDATION: MUST be in "shopping" state
        if (context.order_state !== "shopping") {
          console.error(`❌ INVALID STATE: Cannot add to cart in state "${context.order_state}"`);
          return `⚠️ Para agregar productos, primero necesito mostrarte el menú.\n\n¿De qué negocio querés ver el menú?`;
        }

        // ⚠️ VALIDACIÓN CRÍTICA: No se puede agregar sin vendor seleccionado
        if (!context.selected_vendor_id) {
          console.error(`❌ CRITICAL: No selected_vendor_id in context despite being in shopping state`);
          context.order_state = "shopping";
          await saveContext(context, supabase);
          return `⚠️ Necesito que elijas un negocio primero. ¿Cuál negocio te interesa?`;
        }

        // SIEMPRE usar el vendor del contexto (que fue establecido por ver_menu_negocio)
        let vendorId: string = context.selected_vendor_id;
        let vendor: any = null;

        // Validar que el vendor del contexto existe en la BD
        console.log(`✅ Using vendor from context: ${vendorId} (${context.selected_vendor_name})`);
        const { data, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, is_active, payment_status")
          .eq("id", vendorId)
          .maybeSingle();
        
        if (vendorError) {
          console.error("❌ Error finding vendor by context ID:", vendorError);
          return `Hubo un error al validar el negocio. Por favor intentá de nuevo.`;
        }
        
        if (!data) {
          console.error(`❌ Vendor ${vendorId} from context not found in database`);
          return `El negocio seleccionado ya no está disponible. Por favor elegí otro negocio.`;
        }
        
        vendor = data;
        console.log(`✅ Vendor validated: ${vendor.name} (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
        
        if (!vendor.is_active || vendor.payment_status !== 'active') {
          console.error(`❌ Vendor ${vendor.name} is not available (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
          return `❌ El negocio "${vendor.name}" no está disponible en este momento.\n\nPor favor elegí otro negocio de los disponibles.`;
        }

        console.log(`✅ ===== VENDOR VALIDATED: ${vendor.name} (${vendorId}) =====`);

        // ✅ VALIDACIÓN ANTI-MEZCLA: Verificar que productos sean del vendor actual
        if (!context.selected_vendor_id) {
          return "⚠️ Primero tenés que elegir un negocio. ¿De dónde querés pedir?";
        }

        // Verificar que todos los productos pertenezcan al vendor seleccionado
        for (const item of items) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(item.product_id)) {
            const { data: product } = await supabase
              .from("products")
              .select("id, vendor_id")
              .eq("id", item.product_id)
              .maybeSingle();
            
            if (product && product.vendor_id !== context.selected_vendor_id) {
              console.error(`❌ Product ${item.product_id} belongs to different vendor!`);
              return `⚠️ Ese producto no pertenece a ${context.selected_vendor_name}.\n\n` +
                     `Solo podés agregar productos de un negocio a la vez. 🏪`;
            }
          }
        }

        // 🚨 VALIDACIÓN DE SEGURIDAD: Esto NO debería pasar nunca
        // (ver_menu_negocio ya maneja el cambio de vendor con confirmación)
        if (context.cart.length > 0 && 
            context.selected_vendor_id && 
            vendorId !== context.selected_vendor_id) {
          console.error(`🚨 CRITICAL: Cart has items from different vendor!`);
          console.error(`   Cart vendor: ${context.selected_vendor_id}`);
          console.error(`   Trying to add from: ${vendorId}`);
          return `⚠️ Error interno: Detecté productos de otro negocio en el carrito. ` +
                 `Por favor vacía el carrito con "vaciar carrito" antes de agregar productos de otro negocio.`;
        }

        // Resolver productos
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const resolvedItems: CartItem[] = [];
        for (const item of items) {
          console.log(`🔍 Searching for product: "${item.product_name}" in vendor ${context.selected_vendor_name} (${vendorId})`);
          
          const query = uuidRegex.test(item.product_id)
            ? supabase.from("products").select("id, name, price").eq("id", item.product_id).maybeSingle()
            : supabase
              .from("products")
              .select("id, name, price")
              .ilike("name", `%${item.product_name}%`)
              .eq("vendor_id", vendorId)
              .maybeSingle();

          const { data: product } = await query;
          if (product) {
            console.log(`✅ Product found: ${product.name} - $${product.price}`);
            resolvedItems.push({
              product_id: product.id,
              product_name: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          } else {
            console.warn(`⚠️ PRODUCT NOT FOUND: "${item.product_name}" in vendor ${context.selected_vendor_name} (${vendorId})`);
          }
        }

        if (!resolvedItems.length) {
          // Obtener menú actual del vendor para mostrar opciones reales
          const { data: availableProducts } = await supabase
            .from("products")
            .select("name, price")
            .eq("vendor_id", vendorId)
            .eq("is_available", true)
            .order("name");
          
          const productList = availableProducts && availableProducts.length > 0
            ? availableProducts.map((p, i) => `${i + 1}. ${p.name} - $${p.price}`).join('\n')
            : "No hay productos disponibles";
          
          return `❌ No encontré ese producto en el menú de *${context.selected_vendor_name}*.\n\n` +
                 `📋 Productos disponibles:\n${productList}\n\n` +
                 `Por favor, elegí uno de estos productos. 😊`;
        }

        // Agregar productos validados
        for (const item of resolvedItems) {
          const existing = context.cart.find((c) => c.product_id === item.product_id);
          if (existing) existing.quantity += item.quantity;
          else context.cart.push(item);
        }

        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        // 🔍 LOGGING: Mostrar estado final del carrito para debugging
        console.log("🛒 ===== CART AFTER ADDING =====");
        console.log(`📦 Total items: ${context.cart.length}`);
        context.cart.forEach(item => {
          console.log(`   - ${item.product_name} x${item.quantity} ($${item.price} c/u)`);
        });
        console.log(`💰 Cart total: $${total}`);
        console.log("================================");
        
        return `✅ Productos agregados al carrito de *${context.selected_vendor_name}*.\n\n💰 Total actual: $${total}\n\n¿Querés agregar algo más o confirmás el pedido? 📦`;
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return "El carrito está vacío. ¿Qué te gustaría pedir?";
        }

        // ✅ MOSTRAR EL NEGOCIO DEL CARRITO
        let carrito = `🛒 *Tu carrito de ${context.selected_vendor_name}:*\n\n`;
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        carrito += `\n💰 Total: $${total}\n\n`;
        
        // ⭐ NUEVO: Si el pedido está completo, permitir confirmación directa
        if (context.delivery_type && context.payment_method) {
          context.resumen_mostrado = true;
          carrito += `✅ *Todo listo para confirmar*\n`;
          carrito += `📦 Entrega: ${context.delivery_type === 'pickup' ? 'Retiro en local' : 'Delivery'}\n`;
          carrito += `💳 Pago: ${context.payment_method}\n\n`;
          carrito += `Respondé *"sí"* para confirmar el pedido.`;
          await saveContext(context, supabase);
          console.log("✅ ver_carrito: Cart complete, set resumen_mostrado=true");
        } else {
          carrito += `Para confirmar, decime "confirmar pedido" o "listo" 📦`;
        }

        return carrito;
      }

      case "mostrar_resumen_pedido": {
        console.log("📋 ========== MOSTRAR RESUMEN PEDIDO ==========");
        
        if (context.cart.length === 0) {
          return "⚠️ Tu carrito está vacío. No hay nada que confirmar todavía.";
        }

        if (!context.selected_vendor_id || !context.selected_vendor_name) {
          return "⚠️ Error: No hay negocio seleccionado.";
        }

        let resumen = `📋 *RESUMEN DE TU PEDIDO*\n\n`;
        resumen += `🏪 *Negocio:* ${context.selected_vendor_name}\n\n`;
        
        // 1. Productos del carrito
        resumen += `📦 *Productos:*\n`;
        context.cart.forEach((item, i) => {
          resumen += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        
        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        resumen += `\n💰 *Subtotal:* $${subtotal}\n`;
        
        // 2. Tipo de entrega
        if (context.delivery_type === 'pickup') {
          resumen += `\n📍 *Entrega:* Retiro en local\n`;
          if (context.pickup_instructions) {
            resumen += `   ℹ️ ${context.pickup_instructions}\n`;
          }
        } else if (context.delivery_type === 'delivery') {
          resumen += `\n🚚 *Entrega:* A domicilio\n`;
          if (context.delivery_address) {
            resumen += `📍 *Dirección:* ${context.delivery_address}\n`;
          } else {
            resumen += `⚠️ *Falta confirmar dirección de entrega*\n`;
          }
          resumen += `🚴 *Costo de envío:* (se calculará según distancia)\n`;
        } else {
          resumen += `\n⚠️ *Tipo de entrega no seleccionado*\n`;
        }
        
        // 3. Método de pago
        resumen += `\n💳 *Método de pago:* `;
        if (context.payment_method) {
          const paymentIcons: Record<string, string> = {
            'efectivo': '💵',
            'transferencia': '🏦',
            'mercadopago': '💳'
          };
          const icon = paymentIcons[context.payment_method.toLowerCase()] || '💰';
          resumen += `${icon} ${context.payment_method.charAt(0).toUpperCase() + context.payment_method.slice(1)}\n`;
        } else {
          resumen += `⚠️ *No seleccionado*\n`;
          
          // Si tiene métodos disponibles, mostrarlos
          if (context.available_payment_methods && context.available_payment_methods.length > 0) {
            resumen += `\nPor favor elegí uno de estos métodos:\n`;
            context.available_payment_methods.forEach(method => {
              const methodIcons: Record<string, string> = {
                'efectivo': '💵',
                'transferencia': '🏦',
                'mercadopago': '💳'
              };
              resumen += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${methodIcons[method] || '💰'}\n`;
            });
            
            // No marcar como resumen_mostrado si falta método de pago
            return resumen;
          }
        }
        
        // 4. Total estimado
        resumen += `\n💰💰 *TOTAL ESTIMADO:* $${subtotal}`;
        if (context.delivery_type === 'delivery') {
          resumen += ` + envío`;
        }
        resumen += `\n\n`;
        
        // 5. Verificar que todo esté completo antes de pedir confirmación
        const missingInfo = [];
        if (!context.delivery_type) missingInfo.push("tipo de entrega");
        if (context.delivery_type === 'delivery' && !context.delivery_address) missingInfo.push("dirección");
        if (!context.payment_method) missingInfo.push("método de pago");
        
        if (missingInfo.length > 0) {
          resumen += `⚠️ *Falta completar:* ${missingInfo.join(', ')}\n`;
          return resumen;
        }
        
        // Todo completo, pedir confirmación final
        resumen += `✅ *¿Confirmás el pedido?*\n`;
        resumen += `Respondé "sí" para confirmar o "no" para cancelar.`;
        
        // Marcar que se mostró el resumen
        context.resumen_mostrado = true;
        await saveContext(context, supabase);
        
        console.log("✅ Resumen mostrado y marcado en contexto");
        
        return resumen;
      }

      case "modificar_carrito_completo": {
        // Esta herramienta permite reemplazar el carrito completo
        // Útil para correcciones: "quiero 2 cocas y 1 alfajor"
        
        console.log(`🔄 ========== MODIFYING CART COMPLETELY ==========`);
        console.log(`   Current vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);
        console.log(`   Current cart items: ${context.cart.length}`);
        console.log(`   Order state: ${context.order_state}`);
        
        if (!context.selected_vendor_id) {
          console.log(`❌ No vendor selected - cannot modify cart`);
          return "⚠️ Primero necesito que elijas un negocio.";
        }

        const newCart: CartItem[] = [];
        
        for (const item of args.items) {
          // Buscar producto por nombre
          const { data: product } = await supabase
            .from("products")
            .select("id, name, price")
            .ilike("name", `%${item.product_name}%`)
            .eq("vendor_id", context.selected_vendor_id)
            .eq("is_available", true)
            .maybeSingle();
          
          if (product) {
            newCart.push({
              product_id: product.id,
              product_name: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          } else {
            console.log(`⚠️ Product not found: ${item.product_name}`);
          }
        }
        
        if (newCart.length === 0) {
          return "❌ No encontré ninguno de esos productos en este negocio.";
        }
        
        // Reemplazar carrito completo
        context.cart = newCart;
        
        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        console.log("✅ Cart replaced completely");
        context.cart.forEach(item => {
          console.log(`   - ${item.product_name} x${item.quantity}`);
        });
        
        // ✅ MENSAJE MEJORADO - Incluir nombre del negocio
        let response = `✅ Corregí tu pedido de *${context.selected_vendor_name}*:\n\n`;
        context.cart.forEach(item => {
          response += `• ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        response += `\n💰 Total: $${total}\n\n¿Está correcto?`;
        
        console.log(`✅ Cart modified - Vendor preserved: ${context.selected_vendor_id}`);
        console.log(`================================================`);
        
        return response;
      }

      case "vaciar_carrito": {
        context.cart = [];
        context.delivery_type = undefined;  // ⭐ Limpiar tipo de entrega
        context.conversation_history = []; // 🧹 Limpiar historial al vaciar carrito
        console.log(`🧹 Cart, delivery_type and conversation history cleared`);
        return "🗑️ Carrito vaciado";
      }

      case "seleccionar_tipo_entrega": {
        // ✅ SIEMPRE consultar en tiempo real - NUNCA usar caché
        const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
        console.log(`🔄 Real-time vendor config for ${context.selected_vendor_id}:`, vendorConfig);
        
        // Validar pickup EN TIEMPO REAL
        if (!vendorConfig.allows_pickup && args.tipo === "pickup") {
          return `⚠️ ${context.selected_vendor_name} no acepta retiro en local. Solo delivery.`;
        }
        
        // Validar delivery EN TIEMPO REAL
        if (!vendorConfig.allows_delivery && args.tipo === "delivery") {
          return `⚠️ ${context.selected_vendor_name} no hace delivery. Solo retiro en local.`;
        }
        
        context.delivery_type = args.tipo;
        await saveContext(context, supabase);
        
        if (args.tipo === "pickup") {
          console.log(`✅ Customer selected PICKUP`);
          
          let respuesta = `✅ Perfecto! Tu pedido será para *retiro en local*.\n\n`;
          respuesta += `📍 *Retirá en:*\n${context.selected_vendor_name}\n`;
          
          // Usar datos ya obtenidos de vendorConfig
          if (vendorConfig.address) {
            respuesta += `${vendorConfig.address}\n\n`;
            
            if (vendorConfig.pickup_instructions) {
              respuesta += `📝 *Instrucciones:*\n${vendorConfig.pickup_instructions}\n\n`;
            }
          }
          
          respuesta += `💰 Total: $${context.cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString("es-PY")}\n\n`;
          respuesta += `¿Con qué método querés pagar?`;
          
          return respuesta;
          
        } else {
          console.log(`✅ Customer selected DELIVERY`);
          return `✅ Tu pedido será enviado a domicilio.\n\n¿Cuál es tu dirección de entrega?`;
        }
      }

      case "quitar_producto_carrito": {
        const searchTerm = args.product_id.toLowerCase();
        
        // Buscar por UUID o por nombre parcial
        const index = context.cart.findIndex((item) => 
          item.product_id === args.product_id || 
          item.product_name.toLowerCase().includes(searchTerm)
        );
        
        if (index !== -1) {
          const item = context.cart[index];
          
          // Si tiene más de 1 unidad, solo decrementar
          if (item.quantity > 1) {
            item.quantity -= 1;
            console.log(`📦 Decreased ${item.product_name} quantity to ${item.quantity}`);
            return `✅ Quité una unidad de ${item.product_name}. Ahora tenés ${item.quantity} en el carrito.`;
          } else {
            // Si solo hay 1, remover completamente
            const removed = context.cart.splice(index, 1)[0];
            console.log(`📦 Removed ${removed.product_name} from cart completely`);
            return `✅ Quité ${removed.product_name} del carrito.`;
          }
        }
        
        console.warn(`❌ Product not found in cart: ${args.product_id}`);
        console.log(`🛒 Current cart:`, context.cart.map(i => `${i.product_name} (${i.product_id})`));
        return "❌ No encontré ese producto en el carrito. ¿Querés que te muestre lo que tenés en el carrito?";
      }

      case "crear_pedido": {
        // 🔄 MEJORADO: Si no se mostró el resumen, mostrarlo automáticamente en vez de rechazar
        if (!context.resumen_mostrado) {
          console.log("⚠️ resumen_mostrado=false, auto-calling mostrar_resumen_pedido first");
          const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
          return resumenResult;
        }
        
        console.log("🛒 crear_pedido called with context:", {
          cartLength: context.cart.length,
          cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", "),
          vendorId: context.selected_vendor_id,
          vendorName: context.selected_vendor_name,
          address: args.direccion,
          paymentMethod: args.metodo_pago,
          userLocation: context.user_latitude ? `${context.user_latitude},${context.user_longitude}` : "none",
          currentState: context.order_state,
          paymentMethodsFetched: context.payment_methods_fetched,
          availablePaymentMethods: context.available_payment_methods,
          resumenMostrado: context.resumen_mostrado,
        });
        
        // ⭐ VALIDACIÓN CRÍTICA: Verificar que el método de pago es válido
        if (args.metodo_pago && context.available_payment_methods?.length > 0) {
          const normalizedMethod = args.metodo_pago.toLowerCase().trim();
          const methodMap: Record<string, string> = {
            'efectivo': 'efectivo',
            'cash': 'efectivo',
            'transferencia': 'transferencia',
            'transferencia bancaria': 'transferencia',
            'transfer': 'transferencia',
            'mercadopago': 'mercadopago',
            'mercado pago': 'mercadopago',
            'mp': 'mercadopago'
          };
          
          const mappedMethod = methodMap[normalizedMethod];
          
          if (!mappedMethod || !context.available_payment_methods.includes(mappedMethod)) {
            console.error(`❌ Invalid payment method: "${args.metodo_pago}"`);
            console.error(`   Normalized to: "${mappedMethod}"`);
            console.error(`   Available: [${context.available_payment_methods.join(', ')}]`);
            
            const methodIcons: Record<string, string> = {
              'efectivo': '💵',
              'transferencia': '🏦',
              'mercadopago': '💳'
            };
            
            return `⚠️ El método "${args.metodo_pago}" no está disponible en ${context.selected_vendor_name}.\n\n` +
                   `Métodos aceptados:\n` +
                   context.available_payment_methods.map(m => 
                     `- ${m.charAt(0).toUpperCase() + m.slice(1)} ${methodIcons[m] || '💰'}`
                   ).join('\n') + 
                   `\n\n¿Con cuál querés continuar?`;
          }
          
          console.log(`✅ Payment method validated: "${args.metodo_pago}" -> "${mappedMethod}"`);
        }
        
        // ⭐ AUTO-FETCH payment methods si tiene dirección pero no ha visto los métodos
        if (args.direccion && !context.payment_methods_fetched) {
          console.log(`⚠️ User has address but hasn't seen payment methods yet. Auto-fetching...`);
          
          // Guardar la dirección en el contexto
          context.delivery_address = args.direccion;
          
          // Llamar ver_metodos_pago automáticamente para poblar available_payment_methods
          await ejecutarHerramienta(
            "ver_metodos_pago",
            {},
            context,
            supabase
          );
          
          // Guardar contexto con payment_methods_fetched = true
          await saveContext(context, supabase);
          
          console.log(`✅ Payment methods auto-fetched. Available: [${context.available_payment_methods?.join(', ')}]`);
          console.log(`🔄 Continuing order creation flow...`);
          
          // ⚠️ NO HACER RETURN - dejar que continúe el flujo
          // La validación de método de pago (líneas 736-773) se encargará de validar
        }
        
        // ⚠️ VALIDACIÓN: Permitir crear pedido si tiene todos los requisitos
        // Estado debe ser "checkout" O tener método de pago válido desde "shopping"
        const normalized = args.metodo_pago?.toLowerCase().trim() || "";
        const hasValidPaymentMethod = args.metodo_pago && (
          normalized === "efectivo" || 
          normalized === "transferencia" ||
          normalized === "transferencia bancaria" ||
          normalized === "mercadopago" ||
          normalized === "mercado pago"
        );
        
        if (context.order_state !== "checkout" && !hasValidPaymentMethod) {
          console.error(`❌ Attempt to create order without payment method. State: ${context.order_state}`);
          
          // Si ya vio los métodos, recordarle que elija
          if (context.payment_methods_fetched && context.available_payment_methods) {
            const methodsList = context.available_payment_methods.map(m => `- ${m}`).join('\n');
            return `⚠️ Por favor elegí uno de los métodos de pago disponibles:\n\n${methodsList}`;
          }
          
          return "⚠️ Primero necesito que confirmes tu método de pago.";
        }
        
        // Si viene desde "shopping" con método de pago, cambiar a "checkout"
        if (context.order_state === "shopping" && hasValidPaymentMethod) {
          console.log(`✅ Auto-transitioning from shopping to checkout with payment method: ${args.metodo_pago}`);
          context.order_state = "checkout";
        }

        if (context.cart.length === 0) {
          return "No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?";
        }

        if (!context.selected_vendor_id) {
          console.error("❌ No vendor_id in context!");
          return "Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.";
        }

        // ✅ SIEMPRE consultar en tiempo real para tipo de entrega
        if (!context.delivery_type) {
          const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
          console.log(`🔄 Real-time vendor config for delivery type:`, vendorConfig);
          
          // Si el vendor acepta ambos, preguntar
          if (vendorConfig.allows_pickup && vendorConfig.allows_delivery) {
            return `¿Querés que te enviemos el pedido a domicilio o lo retirás en el local?\n\n` +
                   `Respondé "delivery" o "retiro"`;
          } else if (vendorConfig.allows_pickup && !vendorConfig.allows_delivery) {
            // Solo pickup disponible
            context.delivery_type = 'pickup';
            console.log(`✅ Vendor only allows pickup. Auto-setting to pickup.`);
          } else {
            // Solo delivery o default
            context.delivery_type = 'delivery';
            console.log(`✅ Vendor only allows delivery. Auto-setting to delivery.`);
          }
        }

        // 📍 VALIDACIÓN DE UBICACIÓN Y COBERTURA
        let deliveryCost = 0;
        let deliveryDistance = 0;
        
        // ⭐ Si es PICKUP, NO pedir dirección ni calcular delivery
        if (context.delivery_type === 'pickup') {
          console.log(`✅ Order is PICKUP - skipping address validation and delivery calculation`);
          
          // Obtener dirección del vendor como dirección del pedido
          const { data: vendor } = await supabase
            .from("vendors")
            .select("address")
            .eq("id", context.selected_vendor_id)
            .single();
          
          context.delivery_address = `RETIRO EN LOCAL: ${vendor?.address || 'Dirección no disponible'}`;
          deliveryCost = 0;  // Sin costo de delivery
          
        } else {
          // ⭐ Si es DELIVERY, validar dirección y calcular costo

          if (context.user_latitude && context.user_longitude) {
          // Usuario tiene ubicación, validar cobertura
          const { data: vendor } = await supabase
            .from("vendors")
            .select("id, name, latitude, longitude, delivery_radius_km, delivery_pricing_type, delivery_price_per_km, delivery_fixed_price, delivery_additional_per_km, address")
            .eq("id", context.selected_vendor_id)
            .single();

          if (vendor?.latitude && vendor?.longitude && vendor?.delivery_radius_km) {
            // Calcular distancia
            const { data: distanceResult, error: distError } = await supabase.rpc("calculate_distance", {
              lat1: context.user_latitude,
              lon1: context.user_longitude,
              lat2: vendor.latitude,
              lon2: vendor.longitude,
            });

            if (!distError && distanceResult !== null) {
              deliveryDistance = distanceResult;
              console.log(`📏 Distance: ${distanceResult}km`);
            }

            // 🚚 DELIVERY FIJO: Siempre usar precio fijo sin validar radio
            // El negocio validará manualmente si hace delivery a esa zona
            deliveryCost = vendor.delivery_fixed_price || 0;
            deliveryCost = Math.round(deliveryCost);
            console.log(`🚚 Delivery cost (fixed): ${deliveryCost} $`);
          }

          // ⚠️ CRÍTICO: SIEMPRE usar la dirección del contexto si existe
          // Esto evita que el AI use incorrectamente la dirección del vendor
          if (context.delivery_address) {
            args.direccion = context.delivery_address;
            console.log(`✅ Using saved context address (forced): ${args.direccion}`);
          } else if (!args.direccion || args.direccion.trim() === "") {
            args.direccion = `Lat: ${context.user_latitude.toFixed(6)}, Lon: ${context.user_longitude.toFixed(6)}`;
            console.log(`✅ Using coordinates as address: ${args.direccion}`);
          }
        } else {
          // Sin ubicación GPS - aplicar delivery fijo de todos modos
          const { data: vendor } = await supabase
            .from("vendors")
            .select("delivery_fixed_price")
            .eq("id", context.selected_vendor_id)
            .single();
          
          if (vendor) {
            deliveryCost = vendor.delivery_fixed_price || 0;
            deliveryCost = Math.round(deliveryCost);
            console.log(`🚚 Delivery cost (fixed, no GPS): ${deliveryCost} $`);
          }
          
          // Aceptar dirección de texto manual
          if (!args.direccion || args.direccion.trim() === "") {
            return `📍 Para confirmar tu pedido, necesito tu dirección de entrega.\n\n✍️ Escribí tu dirección completa (calle y número).\n\nEl negocio confirmará si hace delivery a tu zona. 🚗`;
          }
        }  // ⭐ Fin del if/else de ubicación GPS
        }  // ⭐ Fin del else de delivery_type === 'delivery'

        // 🚫 Verificar si el usuario ya tiene un pedido activo (SIEMPRE desde BD)
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id, status, vendor_id, created_at")
          .eq("customer_phone", context.phone)
          .in("status", ["pending", "confirmed", "preparing"])
          .gte("created_at", new Date(Date.now() - 60000).toISOString()) // Últimos 60 segundos
          .order("created_at", { ascending: false });

        if (activeOrders && activeOrders.length > 0) {
          const recentOrder = activeOrders[0];
          
          // Si hay un pedido muy reciente (menos de 60 segundos) con el mismo vendor, evitar duplicación
          if (recentOrder.vendor_id === context.selected_vendor_id) {
            console.warn(`⚠️ Duplicate order attempt detected. Using existing order: ${recentOrder.id}`);
            context.pending_order_id = recentOrder.id;
            context.last_order_id = recentOrder.id;
            
            return `✅ Ya tenés un pedido activo (#${recentOrder.id.substring(0, 8)}).\n\n` +
                   `📊 Podés consultar su estado diciendo "estado del pedido".\n\n` +
                   `Si querés hacer otro pedido, esperá a que este se complete. 😊`;
          }
        }

        // Validar que la dirección y método de pago estén presentes
        if (!args.direccion || args.direccion.trim() === "") {
          return "Por favor indicá tu dirección de entrega.";
        }

        if (!args.metodo_pago) {
          return "Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).";
        }

        // ⚠️ VALIDAR que el método de pago esté habilitado por el vendor
        console.log("💳 Validating payment method...");
        const { data: vendorForPayment, error: vendorPaymentError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorPaymentError || !vendorForPayment) {
          console.error("❌ Error fetching vendor for payment validation:", vendorPaymentError);
          return "Hubo un problema al validar el método de pago. Por favor intentá de nuevo.";
        }

        const paymentSettings = vendorForPayment.payment_settings || {};
        const metodoSolicitado = args.metodo_pago.toLowerCase();

        console.log(`   Requested payment method: ${metodoSolicitado}`);
        console.log(`   Vendor payment settings:`, paymentSettings);

        // Verificar si el método está habilitado
        let metodoValido = false;

        if (metodoSolicitado === "efectivo" && paymentSettings.efectivo === true) {
          metodoValido = true;
        } else if (metodoSolicitado === "transferencia" && paymentSettings.transferencia?.activo === true) {
          metodoValido = true;
        } else if (metodoSolicitado === "mercadopago" && paymentSettings.mercadoPago?.activo === true) {
          metodoValido = true;
        }

        console.log(`   Payment method valid: ${metodoValido}`);

        if (!metodoValido) {
          console.warn(`❌ Invalid payment method attempted: ${metodoSolicitado} for vendor ${vendorForPayment.name}`);
          return `⚠️ El método de pago "${metodoSolicitado}" no está disponible en ${vendorForPayment.name}.\n\n` +
                 `Por favor usá ver_metodos_pago para ver las opciones reales disponibles.`;
        }

        console.log(`✅ Payment method validated: ${metodoSolicitado} is enabled for ${vendorForPayment.name}`);

        context.delivery_address = args.direccion;
        context.payment_method = args.metodo_pago;

        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + deliveryCost;

        console.log("📤 Inserting order:", {
          vendor_id: context.selected_vendor_id,
          customer_phone: context.phone,
          items_count: context.cart.length,
          subtotal,
          delivery_cost: deliveryCost,
          delivery_distance: deliveryDistance,
          total,
          address: context.delivery_address,
          payment_method: context.payment_method,
        });

        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            vendor_id: context.selected_vendor_id,
            customer_name: context.phone,
            customer_phone: context.phone,
            items: context.cart,
            total,
            status: "pending",
            address: context.delivery_address,
            payment_method: context.payment_method,
            address_is_manual: context.delivery_type === 'pickup' ? false : (!context.user_latitude || context.user_latitude === 0), // Marca si es manual (pickup es siempre false)
            delivery_type: context.delivery_type || 'delivery',  // ⭐ NUEVO CAMPO
          })
          .select()
          .single();

        if (error) {
          console.error("❌ Error creating order:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          return `Hubo un error al crear el pedido: ${error.message}. Por favor intentá de nuevo o contactá con el vendedor.`;
        }

        console.log("✅ Order created successfully:", order.id);

        context.pending_order_id = order.id;

        // 💳 Crear registro de pago en order_payments
        const { error: paymentError } = await supabase
          .from("order_payments")
          .insert({
            order_id: order.id,
            amount: total,
            payment_method_name: context.payment_method,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (paymentError) {
          console.error("⚠️ Error creating payment record:", paymentError);
          // No bloqueamos el flujo si falla el pago, pero lo registramos
        } else {
          console.log("✅ Payment record created for order:", order.id);
        }

        // 📧 Notificar al vendedor sobre el nuevo pedido
        try {
          console.log("📨 Sending new order notification to vendor:", context.selected_vendor_id);
          const { data: notifyData, error: notifyError } = await supabase.functions.invoke("notify-vendor", {
            body: {
              orderId: order.id,
              eventType: "new_order",
            },
          });

          if (notifyError) {
            console.error("❌ Error notifying vendor:", notifyError);
          } else {
            console.log("✅ Vendor notification sent:", notifyData);
          }
        } catch (notifyErr) {
          console.error("💥 Exception notifying vendor:", notifyErr);
        }

        // 🗑️ Eliminar direcciones temporales después de crear el pedido
        try {
          const { error: deleteError } = await supabase
            .from("saved_addresses")
            .delete()
            .eq("phone", context.phone)
            .eq("is_temporary", true);

          if (deleteError) {
            console.error("Error deleting temporary addresses:", deleteError);
          } else {
            console.log("🧹 Temporary addresses cleaned up");
          }
        } catch (cleanupError) {
          console.error("Error in cleanup process:", cleanupError);
        }

        let confirmacion = `✅ ¡Pedido creado exitosamente!\n\n`;
        confirmacion += `📦 Pedido #${order.id.substring(0, 8)}\n`;
        confirmacion += `🏪 Negocio: ${context.selected_vendor_name}\n\n`;

        if (context.delivery_type === 'pickup') {
          // ⭐ Mensaje para RETIRO
          confirmacion += `🛒 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;
          confirmacion += `📍 *Retirá en:*\n${context.delivery_address}\n\n`;
          
          if (context.pickup_instructions) {
            confirmacion += `📝 ${context.pickup_instructions}\n\n`;
          }
          
          confirmacion += `💳 Pago: ${context.payment_method}\n`;
          
        } else {
          // ⭐ Mensaje para DELIVERY (código existente)
          // SIEMPRE mostrar desglose con delivery
          confirmacion += `🛒 Subtotal: $ ${Math.round(subtotal).toLocaleString("es-PY")}\n`;
          confirmacion += `🚚 Delivery: $ ${Math.round(deliveryCost).toLocaleString("es-PY")}\n`;
          confirmacion += `💰 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;

          confirmacion += `📍 Dirección: ${context.delivery_address}\n`;
          confirmacion += `💳 Pago: ${context.payment_method}\n`;
          
          // Aviso sobre confirmación de zona
          if (deliveryCost > 0) {
            confirmacion += `\n📌 *Nota:* El negocio confirmará si hace delivery a tu zona.\n`;
          }
        }
        
        confirmacion += `\n`;

        // 🔄 STATE TRANSITION: Asignar estado según método de pago
        const newState = getPendingStateForPayment(context.payment_method);
        const oldState = context.order_state || "checkout";
        context.order_state = newState;
        console.log(`🔄 STATE TRANSITION: ${oldState} → ${newState} (order created with ${context.payment_method})`);

        if (context.payment_method.toLowerCase().includes("transferencia")) {
          // Obtener datos de transferencia del vendor
          const { data: vendorData } = await supabase
            .from("vendors")
            .select("payment_settings")
            .eq("id", context.selected_vendor_id)
            .single();
          
          const transferData = vendorData?.payment_settings?.transferencia;
          
          if (transferData && transferData.activo) {
            confirmacion += `📱 *Datos para transferencia:*\n\n`;
            confirmacion += `• *Alias:* ${transferData.alias}\n`;
            confirmacion += `• *CBU/CVU:* ${transferData.cbu}\n`;
            confirmacion += `• *Titular:* ${transferData.titular}\n\n`;
            confirmacion += `¿Confirmás que deseas proceder con la *transferencia bancaria* para completar tu pedido? 😊\n\n`;
            confirmacion += `Respondé *"sí"* para confirmar o *"no"* para cancelar.`;
          } else {
            confirmacion += `⚠️ Hubo un problema al obtener los datos de transferencia. Por favor contactá al negocio.`;
          }
        } else if (context.payment_method.toLowerCase().includes("efectivo")) {
          confirmacion += `💵 Pagás en efectivo al recibir el pedido.\n\n`;
          confirmacion += `El delivery te contactará pronto. 🚚`;
        } else if (context.payment_method.toLowerCase().includes("mercadopago")) {
          // 🔗 Generar link de pago ANTES de armar el mensaje (forzar envío automático)
          let paymentLinkGenerated = false;
          let paymentLinkUrl = "";
          let paymentErrorMsg = "";
          
          try {
            console.log("💳 Generating MercadoPago payment link for order:", order.id);
            const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
              body: { orderId: order.id },
            });

            if (paymentError) {
              console.error("❌ Error generating payment link:", paymentError);
              paymentErrorMsg = "⚠️ Hubo un problema al generar el link de pago. El negocio te contactará.";
            } else if (paymentData?.success && paymentData?.payment_link) {
              console.log("✅ MercadoPago payment link generated:", paymentData.payment_link);
              paymentLinkGenerated = true;
              paymentLinkUrl = paymentData.payment_link;
            } else if (paymentData?.available_methods) {
              // MercadoPago no está configurado, mostrar métodos alternativos
              console.log("⚠️ MercadoPago not configured, showing alternative methods");
              paymentErrorMsg = "⚠️ MercadoPago no está disponible en este momento.\n\n";
              paymentErrorMsg += "Métodos de pago alternativos:\n\n";
              
              for (const method of paymentData.available_methods) {
                if (method.method === 'transferencia') {
                  paymentErrorMsg += `📱 *Transferencia bancaria:*\n`;
                  paymentErrorMsg += `• Alias: ${method.details.alias}\n`;
                  paymentErrorMsg += `• CBU/CVU: ${method.details.cbu}\n`;
                  paymentErrorMsg += `• Titular: ${method.details.titular}\n`;
                  paymentErrorMsg += `• Monto: $${method.details.amount}\n\n`;
                } else if (method.method === 'efectivo') {
                  paymentErrorMsg += `💵 *Efectivo:* ${method.details.message}\n\n`;
                }
              }
            } else {
              paymentErrorMsg = "⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.";
            }
          } catch (paymentException) {
            console.error("💥 Exception generating payment link:", paymentException);
            paymentErrorMsg = "⚠️ Error al procesar el pago. El negocio te contactará.";
          }
          
          // ✅ FORZAR inclusión del link en el mensaje (independiente del modelo de IA)
          if (paymentLinkGenerated) {
            confirmacion += `💳 *¡Link de pago listo!*\n\n`;
            confirmacion += `🔗 ${paymentLinkUrl}\n\n`;
            confirmacion += `👆 Tocá el link para pagar de forma segura con MercadoPago.\n\n`;
            confirmacion += `Una vez que completes el pago, recibirás la confirmación automáticamente. 😊`;
          } else {
            confirmacion += paymentErrorMsg;
          }
        }  // ⭐ Cierre del else if mercadopago

        // Limpiar carrito después de crear pedido
        context.cart = [];
        context.conversation_history = []; // 🧹 Limpiar historial después de crear pedido
        context.last_order_id = order.id;
        context.pending_order_id = order.id;  // ✅ Guardar pending_order_id para seguimiento
        context.resumen_mostrado = false; // Reset para próximo pedido
        console.log(`🧹 Order created, cart and history cleared`);
        await saveContext(context, supabase);

        return confirmacion;
      }

      case "ver_estado_pedido": {
        let orderId = args.order_id;
        
        // Si no se proporciona order_id, usar pending_order_id o last_order_id del contexto
        if (!orderId && context.pending_order_id) {
          console.log(`📦 Using pending_order_id from context: ${context.pending_order_id}`);
          orderId = context.pending_order_id;
        } else if (!orderId && context.last_order_id) {
          console.log(`📦 Using last_order_id from context: ${context.last_order_id}`);
          orderId = context.last_order_id;
        }
        
        if (!orderId) {
          return "No tengo ningún pedido tuyo registrado recientemente. ¿Querés hacer un nuevo pedido?";
        }
        
        console.log("🔍 Checking order status:", orderId);
        
        const { data: order, error } = await supabase
          .from("orders")
          .select("*, vendors(name)")
          .eq("id", orderId)
          .single();

        if (error || !order) {
          return "No encontré ese pedido. ¿Querés que te ayude con algo más?";
        }

        const statusEmojis: any = {
          pending: "⏳ Pendiente",
          confirmed: "✅ Confirmado",
          preparing: "👨‍🍳 En preparación",
          ready: "🎉 Listo para entregar",
          delivered: "✅ Entregado",
          cancelled: "❌ Cancelado",
        };

        let estado = `📦 Estado del pedido #${order.id.substring(0, 8)}\n\n`;
        estado += `🏪 Negocio: ${order.vendors.name}\n`;
        estado += `📊 Estado: ${statusEmojis[order.status] || order.status}\n`;
        estado += `💰 Total: $${order.total}\n`;

        return estado;
      }

      case "ver_ofertas": {
        const nowIso: string = new Date().toISOString();

        // Si el usuario está en una conversación con un vendor específico, solo mostrar sus ofertas
        const targetVendorId = args.vendor_id || context.selected_vendor_id;

        let query = supabase
          .from("vendor_offers")
          .select("*, vendors(id, name, category, latitude, longitude, delivery_radius_km, is_active)")
          .eq("is_active", true)
          .lte("valid_from", nowIso)
          .or(`valid_until.gte.${nowIso},valid_until.is.null`);

        // Filtrar por vendor si hay uno en contexto o especificado
        if (targetVendorId) {
          query = query.eq("vendor_id", targetVendorId);
        }

        const { data: offers, error } = await query;

        if (error || !offers || offers.length === 0) {
          return targetVendorId
            ? "Este negocio no tiene ofertas activas en este momento."
            : "No hay ofertas disponibles en este momento. 😔";
        }

        // Filtrar ofertas por ubicación y horarios
        let filteredOffers = offers;

        if (!targetVendorId && context.user_latitude && context.user_longitude) {
          // Si no hay vendor específico pero sí ubicación, filtrar por alcance
          const { data: vendorsInRange } = await supabase.rpc("get_vendors_in_range", {
            user_lat: context.user_latitude,
            user_lon: context.user_longitude,
          });

          if (vendorsInRange && vendorsInRange.length > 0) {
            const openVendorIds = vendorsInRange.filter((v: any) => v.is_open).map((v: any) => v.vendor_id);

            filteredOffers = offers.filter((offer: any) => openVendorIds.includes(offer.vendor_id));
          } else {
            filteredOffers = [];
          }
        }

        if (filteredOffers.length === 0) {
          return "No hay ofertas disponibles de negocios que estén abiertos y te hagan delivery en este momento. 😔";
        }

        let resultado = `🎁 ${filteredOffers.length === 1 ? "Oferta disponible" : `${filteredOffers.length} ofertas disponibles`}:\n\n`;

        filteredOffers.forEach((offer: any, i: number) => {
          resultado += `${i + 1}. ${offer.title}\n`;
          resultado += `   🏪 ${offer.vendors.name}\n`;
          resultado += `   📝 ${offer.description}\n`;

          if (offer.discount_percentage) {
            resultado += `   💰 ${offer.discount_percentage}% OFF\n`;
          }
          if (offer.original_price && offer.offer_price) {
            resultado += `   💵 Antes: $${offer.original_price} → Ahora: $${offer.offer_price}\n`;
          }

          const validUntil = new Date(offer.valid_until);
          resultado += `   ⏰ Válido hasta: ${validUntil.toLocaleDateString("es-AR")}\n`;
          resultado += `   ID Negocio: ${offer.vendor_id}\n`;
          resultado += `\n`;
        });

        return resultado;
      }

      case "cancelar_pedido": {
        if (!args.motivo || args.motivo.trim().length < 10) {
          return "Por favor proporciona un motivo detallado para la cancelación (mínimo 10 caracteres).";
        }

        let orderId = args.order_id;
        
        // Si no se proporcionó order_id, usar el último pedido del contexto
        if (!orderId && context.last_order_id) {
          console.log(`📦 Using last_order_id from context: ${context.last_order_id}`);
          orderId = context.last_order_id;
        }
        
        // Si no hay order_id, buscar el último pedido del usuario
        if (!orderId) {
          console.log(`🔍 No order_id provided, searching for user's most recent order`);
          const { data: recentOrders, error: searchError } = await supabase
            .from("orders")
            .select("id, status, created_at")
            .eq("customer_phone", context.phone)
            .in("status", ["pending", "preparing", "confirmed"])
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (searchError || !recentOrders || recentOrders.length === 0) {
            console.warn(`❌ No recent active orders found for ${context.phone}`);
            return "No encontré ningún pedido activo para cancelar. ¿Podrías verificar el número de pedido?";
          }
          
          orderId = recentOrders[0].id;
          console.log(`✅ Found recent order: ${orderId}`);
        }
        
        // Si es un ID corto (8 caracteres), buscar por coincidencia parcial
        if (orderId && orderId.length === 8) {
          console.log(`🔍 Short ID provided (${orderId}), searching by prefix`);
          const { data: matchingOrders, error: prefixError } = await supabase
            .from("orders")
            .select("id")
            .eq("customer_phone", context.phone)
            .ilike("id", `${orderId}%`)
            .limit(1);
          
          if (prefixError || !matchingOrders || matchingOrders.length === 0) {
            return `No encontré un pedido con ID #${orderId}`;
          }
          
          orderId = matchingOrders[0].id;
          console.log(`✅ Matched partial ID to full UUID: ${orderId}`);
        }

        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (fetchError || !order) {
          console.error(`❌ Order not found: ${orderId}`, fetchError);
          return "No encontré ese pedido. Por favor verificá el número de pedido.";
        }

        // Verificar que el pedido pertenece al usuario
        if (order.customer_phone !== context.phone) {
          console.warn(`⚠️ Order ${orderId} does not belong to ${context.phone}`);
          return "Este pedido no te pertenece.";
        }

        if (order.status === "cancelled") {
          return "Este pedido ya está cancelado.";
        }

        if (["delivered", "ready"].includes(order.status)) {
          return "No se puede cancelar un pedido que ya está listo o entregado. Contacta con soporte si necesitas ayuda.";
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", orderId);

        if (updateError) {
          return "Hubo un error al cancelar el pedido. Intenta de nuevo.";
        }

        // Registrar historial
        await supabase.from("order_status_history").insert({
          order_id: orderId,
          status: "cancelled",
          changed_by: "customer",
          reason: args.motivo,
        });

        // 📧 Notificar al vendedor sobre la cancelación
        try {
          await supabase.functions.invoke("notify-vendor", {
            body: {
              orderId: orderId,
              eventType: "order_cancelled",
            },
          });
        } catch (notifyError) {
          console.error("Error notifying vendor about cancellation:", notifyError);
        }

        // 🧹 LIMPIAR CONTEXTO después de cancelación exitosa
        context.order_state = "idle";
        context.pending_order_id = undefined;
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.delivery_type = undefined;
        context.resumen_mostrado = false;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.conversation_history = [];
        await saveContext(context, supabase);
        console.log(`🧹 Context cleaned after order cancellation for order ${orderId}`);

        return `✅ Pedido #${orderId.substring(0, 8)} cancelado.\n📝 Motivo: ${args.motivo}\n\nEl vendedor ha sido notificado.\n\n¿Querés hacer un nuevo pedido? 😊`;
      }

      case "ver_metodos_pago": {
        // Verificar que hay un negocio seleccionado
        if (!context.selected_vendor_id) {
          return "Primero tenés que elegir un negocio. ¿Querés ver los negocios disponibles?";
        }

        // ⭐ LIMPIAR método de pago anterior al obtener nuevos métodos
        context.payment_method = undefined;
        console.log(`🧹 Cleared previous payment method before fetching available methods`);

        // Obtener payment_settings del vendedor
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorError || !vendor) {
          console.error("Error fetching vendor payment settings:", vendorError);
          return "Hubo un problema al obtener los métodos de pago del negocio.";
        }

        const paymentSettings = vendor.payment_settings || {};
        const metodosDisponibles: string[] = [];
        const availableKeys: string[] = []; // ⭐ Para guardar las keys en el contexto
        let datosTransferencia = "";

        // Verificar cada método
        if (paymentSettings.efectivo === true) {
          metodosDisponibles.push("- Efectivo 💵");
          availableKeys.push("efectivo");
        }

        if (paymentSettings.transferencia?.activo === true) {
          metodosDisponibles.push("- Transferencia bancaria 🏦");
          availableKeys.push("transferencia");
          
          // Agregar datos de transferencia si están disponibles
          const { alias, cbu, titular } = paymentSettings.transferencia;
          if (alias && cbu && titular) {
            datosTransferencia = `\n\n📋 *Datos para transferencia:*\n` +
              `• Alias: ${alias}\n` +
              `• CBU/CVU: ${cbu}\n` +
              `• Titular: ${titular}`;
          }
        }

        if (paymentSettings.mercadoPago?.activo === true) {
          metodosDisponibles.push("- MercadoPago 💳");
          availableKeys.push("mercadopago");
        }

        if (metodosDisponibles.length === 0) {
          return `⚠️ ${vendor.name} todavía no configuró métodos de pago. Por favor contactá directamente con el negocio.`;
        }

        // ⭐ GUARDAR EN CONTEXTO
        context.payment_methods_fetched = true;
        context.available_payment_methods = availableKeys;
        console.log(`✅ Payment methods saved to context: ${availableKeys.join(", ")}`);

        const textoMetodos = metodosDisponibles.length === 1 
          ? "Tenés disponible el siguiente método de pago:"
          : "Tenés disponibles los siguientes métodos de pago:";

        return `${textoMetodos}\n\n${metodosDisponibles.join("\n")}${datosTransferencia}\n\n¿Te gustaría confirmar el pedido con ${metodosDisponibles.length === 1 ? 'este método' : 'alguno de estos métodos'}? 😊`;
      }

      case "hablar_con_vendedor": {
        console.log("🔄 Switching to vendor chat mode");

        // Usar vendor_id del contexto si está disponible
        let vendorId = context.selected_vendor_id;

        if (!vendorId) {
          return "Primero necesito que selecciones un negocio. Podés buscar productos o locales para elegir con quién querés hablar.";
        }

        // Validar que sea un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(vendorId)) {
          console.log(`⚠️ Invalid vendor_id format: "${vendorId}", attempting to find by name`);

          // Intentar buscar por nombre si no es UUID
          const { data: foundVendor } = await supabase
            .from("vendors")
            .select("id, name")
            .ilike("name", `%${vendorId}%`)
            .maybeSingle();

          if (foundVendor) {
            vendorId = foundVendor.id;
            context.selected_vendor_id = foundVendor.id; // Actualizar contexto con UUID correcto
            console.log(`✅ Found vendor by name: ${foundVendor.name} (${foundVendor.id})`);
          } else {
            return "No pude encontrar el negocio seleccionado. Por favor buscá locales o productos de nuevo.";
          }
        }

        // Obtener información del vendedor
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("phone, whatsapp_number, name")
          .eq("id", vendorId)
          .single();

        if (vendorError || !vendor) {
          console.error("Error getting vendor:", vendorError);
          return "Hubo un problema al conectar con el negocio. Por favor intentá de nuevo.";
        }

        const vendorPhone = vendor.whatsapp_number || vendor.phone;

        // Verificar si ya existe un chat activo para evitar duplicados
        const { data: existingChat } = await supabase
          .from("vendor_chats")
          .select("id")
          .eq("vendor_id", vendorId)
          .eq("customer_phone", context.phone)
          .eq("is_active", true)
          .maybeSingle();

        let chatId = existingChat?.id;

        // Si no existe un chat activo, crear uno nuevo
        if (!chatId) {
          const { data: newChat, error: chatError } = await supabase
            .from("vendor_chats")
            .insert({
              vendor_id: vendorId,
              customer_phone: context.phone,
              is_active: true,
            })
            .select("id")
            .single();

          if (chatError) {
            console.error("Error creating vendor chat:", chatError);
          } else {
            chatId = newChat.id;
            console.log("✅ Chat created with vendor:", { chatId, vendorId });

            // Crear mensaje inicial del sistema
            await supabase.from("chat_messages").insert({
              chat_id: chatId,
              sender_type: "bot",
              message: `Cliente ${context.phone} solicitó hablar con el vendedor`,
            });

            // 📧 Notificar al vendedor que un cliente quiere hablar
            try {
              console.log("📨 Notifying vendor about customer message request");
              const { data: notifyData, error: notifyError } = await supabase.functions.invoke("notify-vendor", {
                body: {
                  orderId: args.order_id || "no-order",
                  eventType: "customer_message",
                  vendorId: vendorId,
                },
              });

              if (notifyError) {
                console.error("❌ Error notifying vendor:", notifyError);
              } else {
                console.log("✅ Vendor notified about customer message");
              }
            } catch (notifyErr) {
              console.error("💥 Exception notifying vendor:", notifyErr);
            }
          }
        }

        // Actualizar sesión del usuario
        const { error } = await supabase.from("user_sessions").upsert(
          {
            phone: context.phone,
            assigned_vendor_phone: vendorPhone,
            in_vendor_chat: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );

        if (error) {
          console.error("Error updating session:", error);
        }

        let mensaje = `👤 *Conectando con ${vendor.name}*\n\n`;
        mensaje +=
          "Un representante del negocio te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\n";
        mensaje += "Para volver al bot automático, el vendedor puede reactivarlo desde su panel.";

        return mensaje;
      }

      case "registrar_calificacion": {
        // Validar que tengamos al menos una calificación o comentario
        if (!args.delivery_rating && !args.service_rating && !args.product_rating && !args.comment) {
          return "Por favor proporciona al menos una calificación (delivery, atención o producto) o un comentario.";
        }

        // Buscar el pedido más reciente del cliente
        const { data: recentOrder } = await supabase
          .from("orders")
          .select("id, vendor_id")
          .eq("customer_phone", context.phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recentOrder) {
          return "No encontré ningún pedido reciente para calificar. Intenta de nuevo después de realizar un pedido.";
        }

        // Calcular rating general (promedio de los ratings proporcionados)
        const ratings = [args.delivery_rating, args.service_rating, args.product_rating].filter(
          (r) => r !== null && r !== undefined,
        );

        const averageRating =
          ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : null;

        // Insertar review
        const { error } = await supabase.from("vendor_reviews").insert({
          vendor_id: recentOrder.vendor_id,
          order_id: recentOrder.id,
          customer_phone: context.phone,
          customer_name: args.customer_name || context.phone,
          rating: averageRating,
          delivery_rating: args.delivery_rating,
          service_rating: args.service_rating,
          product_rating: args.product_rating,
          comment: args.comment,
        });

        if (error) {
          console.error("Error saving review:", error);
          return "Hubo un error al guardar tu calificación. Por favor intenta de nuevo.";
        }

        let respuesta = "⭐ *¡Gracias por tu calificación!*\n\n";
        respuesta += "📊 *Tu calificación:*\n";
        if (args.delivery_rating) respuesta += `🚚 Tiempo de entrega: ${args.delivery_rating}/5\n`;
        if (args.service_rating) respuesta += `👥 Atención: ${args.service_rating}/5\n`;
        if (args.product_rating) respuesta += `📦 Producto: ${args.product_rating}/5\n`;
        if (args.comment) respuesta += `\n💬 Comentario: "${args.comment}"\n`;
        respuesta += "\nTu opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros! 😊";

        return respuesta;
      }

      case "calificar_plataforma": {
        // Validar calificación
        if (!args.rating || args.rating < 1 || args.rating > 5) {
          return "Por favor proporciona una calificación válida entre 1 y 5 estrellas.";
        }

        // Insertar reseña de plataforma
        const { error } = await supabase.from("platform_reviews").insert({
          user_type: "customer",
          reviewer_phone: context.phone,
          reviewer_name: args.customer_name || context.phone,
          rating: args.rating,
          comment: args.comment || null,
        });

        if (error) {
          console.error("Error saving platform review:", error);
          return "Hubo un error al guardar tu reseña. Por favor intenta de nuevo.";
        }

        let respuesta = "🌟 *¡Gracias por tu reseña de Lapacho!*\n\n";
        respuesta += `⭐ Tu calificación: ${args.rating}/5\n`;
        if (args.comment) respuesta += `\n💬 Comentario: "${args.comment}"\n`;
        respuesta += "\n¡Tu opinión nos ayuda a mejorar la plataforma! 😊";

        return respuesta;
      }

      case "crear_ticket_soporte": {
        const prioridad = args.prioridad || "normal";

        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .insert({
            customer_phone: context.phone,
            customer_name: context.phone,
            subject: args.asunto,
            priority:
              prioridad === "baja"
                ? "low"
                : prioridad === "alta"
                  ? "high"
                  : prioridad === "urgente"
                    ? "urgent"
                    : "normal",
            status: "open",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          return "Hubo un error al crear el ticket. Intenta de nuevo o contacta directamente con soporte.";
        }

        // Crear mensaje inicial en el ticket
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_type: "customer",
          message: args.descripcion,
        });

        return `✅ *Ticket de soporte creado*\n\n📋 ID: #${ticket.id.substring(0, 8)}\n🏷️ Asunto: ${args.asunto}\n⚡ Prioridad: ${prioridad}\n\nNuestro equipo de soporte te contactará pronto. Los mensajes que envíes ahora irán directamente al equipo de soporte.\n\n💡 *Importante:* El bot se desactivará hasta que el equipo de soporte cierre tu ticket.`;
      }

      case "mostrar_menu_ayuda": {
        return `🤖 *MENÚ DE AYUDA - LAPACHO DELIVERY*

¿Qué podés hacer?

🔍 *BUSCAR Y PEDIR*
• Buscar productos (ej: "Quiero pizza")
• Ver locales abiertos ahora
• Ver ofertas y promociones
• Ver el menú de un negocio
• Hacer un pedido

🛒 *MI CARRITO*
• Ver mi carrito actual
• Agregar productos al carrito
• Quitar productos del carrito
• Vaciar el carrito

📦 *MIS PEDIDOS*
• Ver el estado de mi pedido
• Cancelar un pedido

📍 *MIS DIRECCIONES*
• Guardar direcciones para pedidos futuros
• Ver mis direcciones guardadas
• Usar una dirección guardada
• Borrar o renombrar direcciones

⭐ *CALIFICAR*
• Calificar mi pedido
• Calificar la plataforma Lapacho

💬 *SOPORTE*
• Hablar con un vendedor
• Crear un ticket de soporte

Escribí lo que necesites y te ayudo. ¡Es muy fácil! 😊`;
      }

      case "guardar_direccion": {
        // Primero intentar obtener las coordenadas del contexto
        let lat = context.user_latitude;
        let lng = context.user_longitude;
        let address = context.delivery_address;

        // Si no están en el contexto, buscar en la sesión más reciente
        if (!lat || !lng) {
          console.log("⚠️ Coordinates not in context, fetching from database...");
          const { data: session } = await supabase
            .from("user_sessions")
            .select("user_latitude, user_longitude, last_bot_message")
            .eq("phone", context.phone)
            .maybeSingle();

          if (session?.user_latitude && session?.user_longitude) {
            lat = session.user_latitude;
            lng = session.user_longitude;
            console.log(`✅ Found coordinates in session: ${lat}, ${lng}`);

            // Actualizar el contexto para futuras operaciones
            context.user_latitude = lat;
            context.user_longitude = lng;
          }
        }

        // Si aún no tenemos coordenadas, pedir que las comparta
        if (!lat || !lng) {
          return (
            'Parece que no tengo tu ubicación guardada. Necesito que compartas tu ubicación tocando el clip 📎 en WhatsApp y eligiendo "Ubicación". \n\nUna vez que lo hagas, podré guardarla como "' +
            args.nombre +
            '". 😊'
          );
        }

        // Validar nombre
        const nombre = args.nombre.trim();
        if (!nombre || nombre.length < 2) {
          return "Por favor elegí un nombre más descriptivo para tu dirección (mínimo 2 caracteres).";
        }

        // Buscar si ya existe una dirección con ese nombre
        const { data: existing } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección guardada con el nombre "${nombre}". Podés borrarla primero o usar otro nombre.`;
        }

        // Guardar dirección
        const { error } = await supabase.from("saved_addresses").insert({
          phone: context.phone,
          name: nombre,
          address: address || "Ubicación guardada",
          latitude: lat,
          longitude: lng,
          is_temporary: false,
        });

        if (error) {
          console.error("Error saving address:", error);
          return "Hubo un problema al guardar tu dirección. Intentá de nuevo.";
        }

        console.log(`✅ Address saved: ${nombre} at ${lat}, ${lng}`);
        return `✅ Listo, guardé tu dirección como "${nombre}" 📍\n\nLa próxima vez podés decir *"Enviar a ${nombre}"* para usarla rápido. 😊`;
      }

      case "usar_direccion_temporal": {
        if (!context.user_latitude || !context.user_longitude) {
          return "⚠️ No tengo tu ubicación guardada. Por favor compartí tu ubicación usando el botón 📍 de WhatsApp primero.";
        }

        // Marcar como temporal
        context.pending_location_decision = false;

        return `Perfecto 👍 Usaré esta ubicación solo para este pedido.\n\n⚠️ *Importante:* Esta dirección se eliminará automáticamente al finalizar el pedido.\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "listar_direcciones": {
        const { data: addresses, error } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("phone", context.phone)
          .eq("is_temporary", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching addresses:", error);
          return "Hubo un problema al obtener tus direcciones. Intentá de nuevo.";
        }

        if (!addresses || addresses.length === 0) {
          return '📍 No tenés direcciones guardadas todavía.\n\nPodés compartir tu ubicación 📍 y guardarla con un nombre (ej: "Casa", "Trabajo") para usarla en futuros pedidos. 😊';
        }

        let resultado = `📍 *Tus direcciones guardadas:*\n\n`;
        addresses.forEach((addr: any, i: number) => {
          resultado += `${i + 1}. 🏠 *${addr.name}*\n`;
          resultado += `   ${addr.address}\n`;
          resultado += `   _Guardada el ${new Date(addr.created_at).toLocaleDateString("es-AR")}_\n\n`;
        });
        resultado += `💡 Podés decir *"Enviar a ${addresses[0].name}"* para usar una dirección o *"Borrar ${addresses[0].name}"* para eliminarla.`;

        return resultado;
      }

      case "borrar_direccion": {
        const nombre = args.nombre.trim();

        const { data: address } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .eq("is_temporary", false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        const { error } = await supabase.from("saved_addresses").delete().eq("id", address.id);

        if (error) {
          console.error("Error deleting address:", error);
          return "Hubo un problema al borrar la dirección. Intentá de nuevo.";
        }

        return `✅ Listo, eliminé la dirección "${nombre}". 🗑️`;
      }

      case "renombrar_direccion": {
        const nombreViejo = args.nombre_viejo.trim();
        const nombreNuevo = args.nombre_nuevo.trim();

        if (!nombreNuevo || nombreNuevo.length < 2) {
          return "Por favor elegí un nombre más descriptivo (mínimo 2 caracteres).";
        }

        // Buscar dirección a renombrar
        const { data: address } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombreViejo)
          .eq("is_temporary", false)
          .maybeSingle();

        if (!address) {
          return `No encontré una dirección llamada "${nombreViejo}".\n\nPodés ver tus direcciones diciendo "Mis direcciones". 📍`;
        }

        // Verificar que el nuevo nombre no exista
        const { data: existing } = await supabase
          .from("saved_addresses")
          .select("id")
          .eq("phone", context.phone)
          .eq("name", nombreNuevo)
          .maybeSingle();

        if (existing) {
          return `Ya tenés una dirección con el nombre "${nombreNuevo}". Elegí otro nombre. 😊`;
        }

        // Renombrar
        const { error } = await supabase.from("saved_addresses").update({ name: nombreNuevo }).eq("id", address.id);

        if (error) {
          console.error("Error renaming address:", error);
          return "Hubo un problema al renombrar la dirección. Intentá de nuevo.";
        }

        return `✅ Listo, renombré "${nombreViejo}" a "${nombreNuevo}". 📝`;
      }

      case "usar_direccion_guardada": {
        const nombre = args.nombre.trim();

        const { data: address, error } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("phone", context.phone)
          .eq("name", nombre)
          .eq("is_temporary", false)
          .maybeSingle();

        if (error || !address) {
          return `No encontré una dirección llamada "${nombre}".\n\nPodés ver tus direcciones diciendo "Mis direcciones" 📍 o compartir una nueva ubicación.`;
        }

        // Actualizar contexto con la dirección guardada
        context.user_latitude = parseFloat(address.latitude);
        context.user_longitude = parseFloat(address.longitude);
        context.delivery_address = address.address;

        // Actualizar en user_sessions
        await supabase.from("user_sessions").upsert(
          {
            phone: context.phone,
            user_latitude: context.user_latitude,
            user_longitude: context.user_longitude,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );

        return `📍 Perfecto, voy a usar tu dirección "${nombre}".\n\n${address.address}\n\n¿Qué te gustaría pedir? 😊`;
      }

      case "eliminar_todas_direcciones": {
        const { error } = await supabase
          .from("saved_addresses")
          .delete()
          .eq("phone", context.phone)
          .eq("is_temporary", false);

        if (error) {
          console.error("Error deleting all addresses:", error);
          return "Hubo un problema al eliminar tus direcciones. Intentá de nuevo.";
        }

        return `✅ Listo, eliminé todas tus ubicaciones guardadas. 💬\n\nPodés compartir tu ubicación 📍 cuando quieras hacer un nuevo pedido.`;
      }

      case "agregar_direccion_manual": {
        const direccionCompleta = args.direccion_completa.trim();
        const nombre = args.nombre?.trim();

        if (!direccionCompleta || direccionCompleta.length < 10) {
          return "Por favor escribí una dirección más completa (calle, número, ciudad, referencias). Mínimo 10 caracteres.";
        }

        // Si tiene nombre, guardar de forma permanente
        if (nombre && nombre.length >= 2) {
          // Verificar si ya existe
          const { data: existing } = await supabase
            .from("saved_addresses")
            .select("id")
            .eq("phone", context.phone)
            .eq("name", nombre)
            .maybeSingle();

          if (existing) {
            return `Ya tenés una dirección guardada con el nombre "${nombre}". Podés borrarla primero o usar otro nombre.`;
          }

          // Guardar con coordenadas null e indicador manual
          const { error } = await supabase.from("saved_addresses").insert({
            phone: context.phone,
            name: nombre,
            address: direccionCompleta,
            latitude: 0, // Coordenadas en 0,0 indican entrada manual
            longitude: 0,
            is_temporary: false,
            is_manual_entry: true,
          });

          if (error) {
            console.error("Error saving manual address:", error);
            return "Hubo un problema al guardar tu dirección. Intentá de nuevo.";
          }

          return `✅ Dirección guardada como "${nombre}": ${direccionCompleta}\n\n⚠️ Importante: Esta dirección NO fue validada con GPS. El negocio verá que fue ingresada manualmente y confirmará si hace delivery ahí. 📍`;
        } else {
          // Sin nombre = temporal para este pedido
          context.delivery_address = direccionCompleta;
          context.user_latitude = 0; // Marca como manual
          context.user_longitude = 0;

          return `✅ Voy a usar esta dirección para tu pedido: ${direccionCompleta}\n\n⚠️ Esta dirección NO fue validada con GPS. El negocio confirmará si hace delivery ahí. 📍`;
        }
      }

      case "calcular_costo_delivery": {
        // Verificar que hay un negocio seleccionado
        if (!context.selected_vendor_id) {
          return "Primero tenés que elegir un negocio para saber el costo del delivery. ¿Querés que te muestre los locales disponibles?";
        }

        // Verificar que el cliente tiene ubicación
        if (!context.user_latitude || !context.user_longitude || context.user_latitude === 0) {
          return `📍 Para calcular el costo del delivery necesito que compartas tu ubicación.\n\n👉 Tocá el clip 📎 en WhatsApp y elegí "Ubicación"\n\nAsí puedo calcular la distancia desde ${context.selected_vendor_name || "el negocio"} hasta tu domicilio. 🚗`;
        }

        // Obtener información del vendor
        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, latitude, longitude, delivery_radius_km, delivery_pricing_type, delivery_price_per_km, delivery_fixed_price, delivery_additional_per_km")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorError || !vendor) {
          console.error("Error fetching vendor for delivery calc:", vendorError);
          return "Hubo un problema al obtener la información del negocio. Intentá de nuevo.";
        }

        // Verificar que el vendor tiene ubicación configurada
        if (!vendor.latitude || !vendor.longitude) {
          return `${vendor.name} todavía no configuró su ubicación exacta, por lo que no puedo calcular el costo del delivery automáticamente. Podés consultarle directamente al negocio.`;
        }

        // Calcular distancia
        const { data: distance, error: distError } = await supabase.rpc("calculate_distance", {
          lat1: context.user_latitude,
          lon1: context.user_longitude,
          lat2: vendor.latitude,
          lon2: vendor.longitude,
        });

        if (distError || distance === null) {
          console.error("Error calculating distance:", distError);
          return "Hubo un problema al calcular la distancia. Intentá de nuevo.";
        }

        // Verificar si está dentro del radio
        if (distance > vendor.delivery_radius_km) {
          return `😔 Lo siento, ${vendor.name} no hace delivery a tu ubicación.\n\n📍 Tu ubicación está a ${distance.toFixed(1)} km del local.\n🚗 Radio de cobertura: ${vendor.delivery_radius_km} km\n\n💡 Podés buscar otros negocios más cercanos.`;
        }

        // Calcular costo según el tipo de pricing
        const pricingType = vendor.delivery_pricing_type || 'per_km';
        let deliveryCost = 0;
        let costExplanation = "";

        if (pricingType === 'fixed') {
          deliveryCost = vendor.delivery_fixed_price || 0;
          costExplanation = "Precio fijo";
        } else if (pricingType === 'base_plus_km') {
          const basePrice = vendor.delivery_fixed_price || 0;
          const additionalPerKm = vendor.delivery_additional_per_km || 0;
          const additionalDistance = Math.max(0, distance - 1);
          deliveryCost = basePrice + (additionalDistance * additionalPerKm);
          
          if (distance <= 1) {
            costExplanation = `Precio base (dentro del primer km)`;
          } else {
            costExplanation = `$ ${Math.round(basePrice).toLocaleString("es-PY")} (base) + $ ${Math.round(additionalDistance * additionalPerKm).toLocaleString("es-PY")} (${additionalDistance.toFixed(2)} km adicionales × $ ${Math.round(additionalPerKm).toLocaleString("es-PY")})`;
          }
        } else {
          // per_km
          const pricePerKm = vendor.delivery_price_per_km || 0;
          deliveryCost = distance * pricePerKm;
          costExplanation = `${distance.toFixed(1)} km × $ ${Math.round(pricePerKm).toLocaleString("es-PY")}`;
        }

        deliveryCost = Math.round(deliveryCost);

        if (deliveryCost === 0) {
          return `✅ ¡${vendor.name} hace delivery a tu zona!\n\n📏 Distancia: ${distance.toFixed(1)} km\n\n💰 El delivery está incluido en el precio total sin costo adicional. 🎉`;
        }

        let response = `✅ ¡${vendor.name} hace delivery a tu zona!\n\n📏 Distancia: ${distance.toFixed(1)} km\n💰 Costo del delivery: $ ${deliveryCost.toLocaleString("es-PY")}`;
        
        if (costExplanation && pricingType !== 'fixed') {
          response += `\n   (${costExplanation})`;
        }
        
        response += `\n\nEste monto se suma al total de tu pedido al confirmar. 🚚`;

        return response;
      }

      default:
        return `Herramienta ${toolName} no implementada`;
    }
  } catch (error) {
    console.error(`Error ejecutando ${toolName}:`, error);
    return `Error al ejecutar ${toolName}: ${error.message}`;
  }
}

// ==================== HELPER FUNCTIONS ====================

// Helper function para registrar analytics de cambio de vendor
async function trackVendorChange(
  context: ConversationContext,
  action: 'confirmed' | 'cancelled',
  supabase: any
) {
  try {
    const hashPhone = async (phone: string): Promise<string> => {
      const msgBuffer = new TextEncoder().encode(phone);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
    
    const phoneHash = await hashPhone(context.phone);
    const cartTotal = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    
    await supabase
      .from('vendor_change_analytics')
      .insert({
        user_phone_hash: phoneHash,
        action,
        current_vendor_id: context.selected_vendor_id,
        current_vendor_name: context.selected_vendor_name || 'Unknown',
        pending_vendor_id: context.pending_vendor_change!.new_vendor_id,
        pending_vendor_name: context.pending_vendor_change!.new_vendor_name,
        cart_items_count: context.cart.length,
        cart_total_amount: cartTotal,
        order_state: context.order_state,
        metadata: {
          cart_items: context.cart.map(i => ({ name: i.product_name, qty: i.quantity }))
        }
      });
    
    console.log(`📊 Analytics: User ${action} vendor change`);
  } catch (error) {
    console.error('📊 Analytics error:', error);
  }
}

// ==================== AGENTE PRINCIPAL ====================

export async function handleVendorBot(message: string, phone: string, supabase: any, imageUrl?: string): Promise<string> {
  const normalizedPhone = normalizeArgentinePhone(phone);
  console.log("🤖 AI Bot START - Phone:", normalizedPhone, "Message:", message, "ImageUrl:", imageUrl);

  try {
    // 🔄 COMANDO DE REINICIO: Detectar palabras clave para limpiar memoria
    const resetCommands = ['reiniciar', 'empezar de nuevo', 'borrar todo', 'limpiar memoria', 'reset', 'comenzar de nuevo', 'nuevo pedido', 'empezar'];
    const normalizedMessage = message.toLowerCase().trim();
    
    if (resetCommands.some(cmd => normalizedMessage.includes(cmd))) {
      console.log('🔄 Reset command detected, clearing user memory...');
      
      // Limpiar toda la memoria del usuario
      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_bot_message: JSON.stringify({
            phone: normalizedPhone,
            cart: [],
            conversation_history: [],
            user_latitude: undefined,
            user_longitude: undefined,
            pending_location_decision: false,
          }),
        })
        .eq('phone', normalizedPhone);
      
      if (error) {
        console.error('Error clearing memory:', error);
      }
      
      return '🔄 ¡Listo! Borré toda tu memoria de conversación.\n\n¡Empecemos de nuevo! ¿Qué estás buscando hoy? 😊';
    }
    
    // Cargar contexto
    const context = await getContext(normalizedPhone, supabase);
    
    // 🔄 VALIDACIÓN DE SINCRONIZACIÓN: Verificar si pending_order_id ya fue cancelado/entregado
    if (context.pending_order_id) {
      console.log(`🔄 Checking sync status for pending_order_id: ${context.pending_order_id}`);
      const { data: orderCheck } = await supabase
        .from("orders")
        .select("status")
        .eq("id", context.pending_order_id)
        .single();
      
      // Si el pedido no existe o ya fue cancelado/entregado, limpiar contexto
      if (!orderCheck || ['cancelled', 'delivered'].includes(orderCheck.status)) {
        console.log(`🔄 Detected stale order state - order is ${orderCheck?.status || 'not found'}, cleaning context`);
        context.order_state = "idle";
        context.pending_order_id = undefined;
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.delivery_type = undefined;
        context.resumen_mostrado = false;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.conversation_history = [];
        await saveContext(context, supabase);
        console.log(`🧹 Stale context cleaned successfully`);
      }
    }
    
    // ⚠️ VALIDACIÓN AUTOMÁTICA: Limpiar payment_method si es inválido
    if (context.payment_method && 
        context.available_payment_methods?.length > 0 &&
        !context.available_payment_methods.includes(context.payment_method)) {
      
      console.warn(`⚠️ INCONSISTENCY DETECTED: payment_method="${context.payment_method}" is NOT in available_payment_methods=[${context.available_payment_methods.join(',')}]`);
      console.warn(`   Auto-cleaning invalid payment method from context`);
      
      context.payment_method = undefined;
      await saveContext(context, supabase);
      
      console.log(`✅ Invalid payment method cleared successfully`);
    }
    
    // 💳 Log payment validation state
    if (context.payment_method || context.available_payment_methods) {
      console.log(`💳 Payment validation: method=${context.payment_method || 'none'}, available=[${context.available_payment_methods?.join(',') || 'none'}]`);
    }
    
    // 🧹 LIMPIAR CONTEXTO si hay un pedido ACTIVO del mismo vendor O si el vendor ya no existe
    // SOLO limpiamos si el usuario está en estados seguros (idle/order_placed)
    // NO limpiamos si está en medio de un flujo activo
    if (context.selected_vendor_id || context.cart.length > 0) {
      console.log('🔍 Validating context data...');
      console.log(`   Current vendor: ${context.selected_vendor_id} (${context.selected_vendor_name})`);
      console.log(`   Cart items: ${context.cart.length}`);
      console.log(`   Order state: ${context.order_state}`);
      console.log(`   Pending order: ${context.pending_order_id}`);
      let shouldClearContext = false;
      
      // Verificar si hay pedidos ACTIVOS del mismo vendor en las últimas 24h
      // SOLO limpiamos si el usuario está comenzando un nuevo flujo (idle/order_completed/order_cancelled)
      // NO limpiamos si está en medio de hacer un pedido
      const safeStates = ['idle', 'order_completed', 'order_cancelled'];
      const isInSafeState = !context.order_state || safeStates.includes(context.order_state);
      
      if (context.selected_vendor_id && isInSafeState) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: activeOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, status, created_at, vendor_id')
          .eq('customer_phone', normalizedPhone)
          .eq('vendor_id', context.selected_vendor_id)
          .in('status', ['pending', 'preparing', 'ready', 'in_transit'])  // Solo pedidos activos
          .gte('created_at', twentyFourHoursAgo)  // Solo últimas 24h
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (ordersError) {
          console.error('❌ Error checking active orders:', ordersError);
        }
        
        if (activeOrders && activeOrders.length > 0) {
          const activeOrder = activeOrders[0];
          
          // ⭐ EXCEPCIÓN: Si es el pedido que estamos procesando, NO limpiar
          if (activeOrder.id !== context.pending_order_id) {
            console.log(`⚠️ Found active order from same vendor: ${activeOrder.id} (${activeOrder.status})`);
            console.log(`   Created: ${activeOrder.created_at}`);
            console.log(`   This indicates a duplicate order attempt`);
            shouldClearContext = true;
          } else {
            console.log(`✅ Active order found but it's the current pending order - OK`);
          }
        } else {
          console.log(`✅ No active orders found - OK to continue`);
        }
      } else if (context.selected_vendor_id && !isInSafeState) {
        console.log(`⏭️ Skipping active order check - user is in active flow (${context.order_state})`);
      }
      
      // Verificar si el vendor del contexto todavía existe y está activo
      if (context.selected_vendor_id && !shouldClearContext) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, name, is_active, payment_status')
          .eq('id', context.selected_vendor_id)
          .maybeSingle();
        
        if (!vendor || !vendor.is_active || vendor.payment_status !== 'active') {
          console.log(`⚠️ Vendor in context no longer exists or is inactive: ${context.selected_vendor_id}`);
          shouldClearContext = true;
        }
      }
      
      // Limpiar contexto si es necesario
      if (shouldClearContext) {
        console.log('🧹 ========== CLEARING CONTEXT ==========');
        console.log(`   Reason: Found duplicate active order`);
        console.log(`   Current state: ${context.order_state}`);
        console.log(`   Vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);
        console.log(`   Cart items: ${context.cart.length}`);
        console.log('========================================');
        
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.pending_order_id = undefined;
        context.order_state = 'idle';
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.delivery_type = undefined;  // ⭐ Limpiar tipo de entrega
        context.vendor_allows_pickup = undefined;  // ⭐ Limpiar info de pickup
        context.pickup_instructions = undefined;  // ⭐ Limpiar instrucciones
        context.conversation_history = []; // 🧹 Limpiar historial en reset completo
        console.log(`🧹 Full context reset including conversation history and pickup info`);
        
        await saveContext(context, supabase);
        console.log('✅ Context cleared - user can start fresh');
      }
    }
    
    // 📄 MANEJO ESPECIAL: Comprobante recibido
    if (message === 'comprobante_recibido' && imageUrl && context.pending_order_id) {
      console.log('💳 Processing payment receipt for order:', context.pending_order_id);
      
      // Actualizar la orden con el payment_receipt_url
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          payment_receipt_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', context.pending_order_id);
      
      if (updateError) {
        console.error('Error updating order with receipt:', updateError);
        return '❌ Hubo un problema al procesar tu comprobante. Por favor, intenta enviarlo de nuevo o contactá con el negocio.';
      }
      
      // ✅ NO limpiar pending_order_id - mantenerlo para consultas de estado
      // Solo se limpiará cuando el pedido se entregue, cancele o inicie uno nuevo
      context.payment_receipt_url = imageUrl;
      await saveContext(context, supabase);
      
      return `✅ ¡Perfecto! Recibí tu comprobante de pago. 📄\n\nEl negocio lo revisará y confirmará tu pedido pronto.\n\nPodés seguir el estado de tu pedido en cualquier momento. 😊\n\n¿Necesitás algo más?`;
    }
    console.log("📋 Context loaded:", {
      phone: context.phone,
      cartItems: context.cart.length,
      cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "empty",
      vendor: context.selected_vendor_name,
      vendorId: context.selected_vendor_id,
      historyLength: context.conversation_history.length,
      hasLocation: !!(context.user_latitude && context.user_longitude),
    });

    // 🚫 VALIDACIÓN TEMPRANA: Bloquear pedidos duplicados cuando hay uno activo
    const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
    const newOrderKeywords = ['quiero pedir', 'quiero hacer un pedido', 'nuevo pedido', 'hacer pedido', 'quiero comprar', 'ver locales', 'ver negocios', 'ver menu', 'ver menú'];
    
    if (pendingStates.includes(context.order_state || '')) {
      const messageLower = message.toLowerCase();
      const wantsNewOrder = newOrderKeywords.some(kw => messageLower.includes(kw));
      
      if (wantsNewOrder) {
        console.log(`🚫 BLOCKED: User tried to start new order with active order in state: ${context.order_state}`);
        const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
        const stateDisplay = context.order_state?.replace('order_pending_', '').replace('_', ' ').toUpperCase() || 'ACTIVO';
        
        return `⏳ Ya tenés un pedido activo (#${orderId}) en estado *${stateDisplay}*.\n\n📊 Podés:\n- Decir "estado de mi pedido" para ver cómo va\n- Decir "cancelar pedido" si querés cancelarlo\n\nUna vez completado o cancelado, podés hacer un nuevo pedido. 😊`;
      }
    }

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({
      role: "user",
      content: message,
    });

    // 🔄 MANEJO ESPECIAL: Confirmación de cambio de negocio
    // Si hay un pending_vendor_change, el usuario debe confirmar sí/no
    if (context.pending_vendor_change) {
      const userResponse = message.toLowerCase().trim();
      
      // ✅ Usuario confirma el cambio
      if (userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|cambio)/)) {
        console.log(`✅ User confirmed vendor change`);
        
        // Registrar analytics
        await trackVendorChange(context, 'confirmed', supabase);
        
        // Aplicar cambio
        context.cart = [];
        context.selected_vendor_id = context.pending_vendor_change.new_vendor_id;
        context.selected_vendor_name = context.pending_vendor_change.new_vendor_name;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.payment_methods_fetched = false; // ⭐ Resetear métodos de pago
        context.available_payment_methods = []; // ⭐ Limpiar lista de métodos
        context.pending_vendor_change = undefined;
        context.order_state = "browsing"; // ✅ Volver a browsing, no shopping
        context.conversation_history = []; // 🧹 Limpiar historial al cambiar vendor
        console.log(`🧹 Cleared conversation history on vendor change`);
        
        await saveContext(context, supabase);
        
        // ✅ Mensaje mejorado
        const response = `✅ Perfecto, carrito vaciado.\n\n` +
                         `Ahora estás viendo el menú de *${context.selected_vendor_name}*.\n\n` +
                         `¿Qué querés pedir? 🍕`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // ❌ Usuario rechaza el cambio
      if (userResponse.match(/^(no|nop|cancel|cancela)/)) {
        console.log(`❌ User rejected vendor change`);
        
        // Registrar analytics
        await trackVendorChange(context, 'cancelled', supabase);
        
        // Mantener todo igual
        context.pending_vendor_change = undefined;
        await saveContext(context, supabase);
        
        const response = `Ok, seguimos con ${context.selected_vendor_name}. ¿Qué más querés agregar al pedido?`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // Si la respuesta no es clara, volver a preguntar
      const clarificationResponse = `Por favor confirmá si querés cambiar de negocio.\n\nRespondé *"sí"* para cambiar a ${context.pending_vendor_change.new_vendor_name} o *"no"* para seguir con ${context.selected_vendor_name}.`;
      
      context.conversation_history.push({
        role: "assistant",
        content: clarificationResponse,
      });
      await saveContext(context, supabase);
      
      return clarificationResponse;
    }

    // 🔄 MANEJO ESPECIAL: Usuario en order_pending_mp pide el link de pago
    if (context.order_state === "order_pending_mp") {
      const userMessage = message.toLowerCase().trim();
      
      // Si el usuario pide el link de pago
      if (userMessage.match(/link|pag(o|ar|ame)|mercadopago|mp/i)) {
        
        if (!context.pending_order_id) {
          return "❌ No encontré un pedido pendiente. Por favor iniciá un nuevo pedido.";
        }
        
        try {
          console.log("🔗 User requesting payment link for order:", context.pending_order_id);
          
          // Generar link de pago
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
            body: { orderId: context.pending_order_id },
          });
          
          let response = "";
          
          if (paymentError) {
            console.error("❌ Error generating payment link:", paymentError);
            response = `⚠️ Hubo un problema al generar el link de pago.\n\nPor favor contactá al negocio para coordinar el pago.`;
          } else if (paymentData?.success && paymentData?.payment_link) {
            console.log("✅ Payment link generated:", paymentData.payment_link);
            response = `🔗 *Link de pago de MercadoPago:*\n${paymentData.payment_link}\n\n`;
            response += `👆 Tocá el link para completar tu pago de forma segura.\n\n`;
            response += `Una vez que pagues, recibirás la confirmación automáticamente. 😊`;
          } else if (paymentData?.available_methods) {
            response = `⚠️ MercadoPago no está disponible en este momento.\n\n`;
            response += `Métodos de pago alternativos:\n\n`;
            
            for (const method of paymentData.available_methods) {
              if (method.method === 'transferencia') {
                response += `📱 *Transferencia bancaria:*\n`;
                response += `• Alias: ${method.details.alias}\n`;
                response += `• CBU/CVU: ${method.details.cbu}\n`;
                response += `• Titular: ${method.details.titular}\n`;
                response += `• Monto: $${method.details.amount}\n\n`;
              } else if (method.method === 'efectivo') {
                response += `💵 *Efectivo:* ${method.details.message}\n\n`;
              }
            }
          } else {
            response = `⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.`;
          }
          
          context.conversation_history.push({
            role: "assistant",
            content: response,
          });
          await saveContext(context, supabase);
          
          return response;
        } catch (error) {
          console.error("💥 Exception generating payment link:", error);
          return `⚠️ Error al procesar tu solicitud. Por favor intentá de nuevo o contactá al negocio.`;
        }
      }
    }

    // 🔍 VALIDACIÓN: Detectar intentos de confirmar pedido sin productos en carrito
    const confirmPhrases = ['confirmar', 'confirmo', 'listo', 'eso es todo', 'si confirmo', 'confirma', 'dale'];
    const normalizedMsgConfirm = message.toLowerCase().trim();
    const isConfirming = confirmPhrases.some(phrase => normalizedMsgConfirm.includes(phrase));

    if (isConfirming && context.order_state === 'shopping') {
      console.log(`🔍 User attempting to confirm order. Cart items: ${context.cart.length}`);
      console.log(`📋 Cart validation: ${context.cart.length} items in DB`);
      console.log(`🔍 Cart contents: ${context.cart.map(i => `${i.product_name}x${i.quantity}`).join(', ') || 'EMPTY'}`);
      console.log(`📋 resumen_mostrado: ${context.resumen_mostrado}, delivery_type: ${context.delivery_type}, payment_method: ${context.payment_method}`);
      
      if (context.cart.length === 0) {
        console.warn(`⚠️ CRITICAL: User trying to confirm with EMPTY cart!`);
        console.warn(`   This should never happen - cart is empty but user thinks they have products`);
        
        const emptyCartResponse = "⚠️ Tu carrito está vacío. Primero agregá productos del menú de " +
               `${context.selected_vendor_name || 'un negocio'}.\n\n¿Querés que te muestre el menú?`;
        
        context.conversation_history.push({
          role: "assistant",
          content: emptyCartResponse,
        });
        await saveContext(context, supabase);
        
        return emptyCartResponse;
      }
      
      // 🔄 NUEVO: Si el pedido está completo y ya se mostró el resumen, crear pedido directamente
      if (context.resumen_mostrado && context.delivery_type && context.payment_method) {
        console.log(`✅ Order is complete, creating order automatically...`);
        
        const orderResult = await ejecutarHerramienta(
          "crear_pedido",
          {
            direccion: context.delivery_address || '',
            metodo_pago: context.payment_method
          },
          context,
          supabase
        );
        
        context.conversation_history.push({
          role: "assistant",
          content: orderResult,
        });
        await saveContext(context, supabase);
        
        return orderResult;
      }
      
      // 🔄 NUEVO: Si tiene delivery_type y payment_method pero no se mostró resumen, mostrarlo
      if (context.delivery_type && context.payment_method && !context.resumen_mostrado) {
        console.log(`📋 Showing summary before creating order...`);
        
        const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
        
        context.conversation_history.push({
          role: "assistant",
          content: resumenResult,
        });
        await saveContext(context, supabase);
        
        return resumenResult;
      }
      
      // Si tiene productos pero no está completo, mostrar carrito y pedir lo que falta
      console.log(`✅ User confirming with ${context.cart.length} items. Forcing ver_carrito to show real cart...`);
      const cartSummary = await ejecutarHerramienta("ver_carrito", {}, context, supabase);
      
      let confirmResponse = cartSummary;
      
      // Agregar lo que falta
      if (!context.delivery_type) {
        confirmResponse += "\n\n¿Lo retirás en el local o te lo enviamos? 🏪🚚";
      } else if (context.delivery_type === 'delivery' && !context.delivery_address) {
        confirmResponse += "\n\nCompartí tu dirección o ubicación GPS 📍";
      } else if (!context.payment_method) {
        // Mostrar métodos de pago disponibles
        const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
        confirmResponse += "\n\n" + paymentResult;
      }
      
      context.conversation_history.push({
        role: "assistant",
        content: confirmResponse,
      });
      await saveContext(context, supabase);
      
      return confirmResponse;
    }

    // 🔍 DETECCIÓN AUTOMÁTICA: Usuario eligiendo método de pago
    // Si el bot ya mostró los métodos de pago, el usuario aún no eligió, y tiene dirección O es pickup
    if (context.payment_methods_fetched && !context.payment_method && 
        (context.delivery_address || context.delivery_type === 'pickup')) {
      console.log(`🔍 User seems to be choosing payment method. Message: ${message}`);
      console.log(`📋 Available methods: ${context.available_payment_methods?.join(', ')}`);
      console.log(`🚚 Delivery type: ${context.delivery_type}`);
      
      const normalizedMsg = message.toLowerCase().trim();
      let selectedMethod: string | null = null;
      
      // Detectar método seleccionado explícitamente
      if (normalizedMsg.includes('efectivo') || normalizedMsg.includes('cash')) {
        selectedMethod = 'efectivo';
      } else if (normalizedMsg.includes('transferencia') || normalizedMsg.includes('transfer')) {
        selectedMethod = 'transferencia';
      } else if (normalizedMsg.includes('mercado') || normalizedMsg.includes('mp') || normalizedMsg.includes('mercadopago')) {
        selectedMethod = 'mercadopago';
      }
      
      // 🆕 Si el usuario confirma con "Si/Ok/Dale" y hay UN solo método disponible, auto-seleccionarlo
      if (!selectedMethod) {
        const confirmKeywords = /^(s[ií]|si|yes|dale|ok|confirmo|listo|confirmar)$/i;
        if (confirmKeywords.test(normalizedMsg) && 
            context.available_payment_methods?.length === 1) {
          selectedMethod = context.available_payment_methods[0];
          console.log(`✅ Auto-selected single available method: ${selectedMethod}`);
        }
      }
      
      if (selectedMethod) {
        // Validar que el método seleccionado está en la lista de disponibles
        if (!context.available_payment_methods || !context.available_payment_methods.includes(selectedMethod)) {
          console.warn(`❌ User selected unavailable method: ${selectedMethod}`);
          const availableList = context.available_payment_methods?.map(m => `- ${m}`).join('\n') || '- (ninguno disponible)';
          const errorResponse = `⚠️ El método "${selectedMethod}" no está disponible en ${context.selected_vendor_name}.\n\n` +
                                `Por favor elegí uno de estos:\n${availableList}`;
          
          context.conversation_history.push({
            role: "assistant",
            content: errorResponse,
          });
          await saveContext(context, supabase);
          
          return errorResponse;
        }
        
        // Método válido - guardar y proceder a crear pedido
        console.log(`✅ Valid payment method selected: ${selectedMethod}`);
        context.payment_method = selectedMethod;
        
        // Determinar la dirección correcta según el tipo de entrega
        const orderAddress = context.delivery_type === 'pickup' 
          ? `Retiro en local: ${context.selected_vendor_name}` 
          : context.delivery_address;
        
        // Llamar automáticamente a crear_pedido
        try {
          const orderResult = await ejecutarHerramienta(
            "crear_pedido",
            {
              direccion: orderAddress,
              metodo_pago: selectedMethod
            },
            context,
            supabase
          );
          
          context.conversation_history.push({
            role: "assistant",
            content: orderResult,
          });
          await saveContext(context, supabase);
          
          return orderResult;
        } catch (error) {
          console.error("❌ Error creating order:", error);
          return "Hubo un error al crear tu pedido. Por favor intentá de nuevo.";
        }
      }
    }

    // 🔄 MANEJO ESPECIAL: Confirmación de transferencia bancaria
    if (context.order_state === "order_pending_transfer") {
      const userResponse = message.toLowerCase().trim();
      
      // 🔄 Ignorar menciones repetidas de "transferencia" - el usuario ya lo eligió
      if (userResponse.match(/transfer/i) && !userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|no|nop|cancel)/)) {
        console.log(`ℹ️ User mentioned "transferencia" again - reminding about confirmation`);
        const reminder = `Ya seleccionaste transferencia bancaria como método de pago. 👍\n\n` +
                        `Solo necesito que *confirmes* si querés continuar con el pedido.\n\n` +
                        `Respondé:\n` +
                        `• *"Sí"* para confirmar el pedido\n` +
                        `• *"No"* para cancelar`;
        
        context.conversation_history.push({
          role: "assistant",
          content: reminder,
        });
        
        return reminder;
      }
      
      // ✅ Usuario confirma la transferencia
      if (userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|listo|perfecto|continua|continuar)/)) {
        console.log(`✅ User confirmed bank transfer payment`);
        
        context.order_state = "order_confirmed";
        await saveContext(context, supabase);
        
        const response = `✅ ¡Perfecto! Tu pedido está confirmado.\n\n` +
                        `📸 Ahora enviame el *comprobante de transferencia* para que el negocio pueda procesar tu pedido.\n\n` +
                        `Podés enviar una foto o captura del comprobante. 📱`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // ❌ Usuario cancela el pedido
      if (userResponse.match(/^(no|nop|cancel|cancela|cancelar)/)) {
        console.log(`❌ User cancelled order during transfer confirmation`);
        
        // Cancelar el pedido si existe
        if (context.pending_order_id) {
          await supabase
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", context.pending_order_id);
        }
        
        context.order_state = "idle";
        context.pending_order_id = undefined;
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.conversation_history = []; // 🧹 Limpiar historial al cancelar pedido
        console.log(`🧹 Order cancelled, full context reset`);
        await saveContext(context, supabase);
        
        const response = `Pedido cancelado. ¿En qué más puedo ayudarte? 😊`;
        
        context.conversation_history.push({
          role: "assistant",
          content: response,
        });
        await saveContext(context, supabase);
        
        return response;
      }
      
      // Si la respuesta no es clara, recordar que debe confirmar
      const clarificationResponse = `Por favor confirmá si vas a hacer la transferencia bancaria.\n\n` +
                                    `Respondé *"sí"* para confirmar o *"no"* para cancelar el pedido.`;
      
      context.conversation_history.push({
        role: "assistant",
        content: clarificationResponse,
      });
      await saveContext(context, supabase);
      
      return clarificationResponse;
    }

    // Inicializar OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    console.log("🔄 Starting conversation loop...");

    let continueLoop = true;
    let finalResponse = "";
    let iterationCount = 0;
    const MAX_ITERATIONS = 8; // Aumentado para permitir operaciones complejas // Prevenir loops infinitos
    
    // 🛡️ Rate limiting por herramienta - prevenir loops infinitos
    const toolCallTracker = new Map<string, number>();

    // 🎯 CRÍTICO: Construir mensajes UNA SOLA VEZ antes del loop
    // Esto asegura que los tool calls previos y sus resultados se preserven
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...context.conversation_history.slice(-15), // Últimos 15 mensajes para no saturar
    ];

    // Loop de conversación con tool calling
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
    console.log(`🔁 Iteration ${iterationCount}/${MAX_ITERATIONS}`);
    console.log(`📝 Messages count: ${messages.length}, Last 3 roles:`, messages.slice(-3).map(m => m.role));
    console.log(`🎯 Current state: ${context.order_state || "idle"}`);
    console.log(`🛒 Cart items: ${context.cart.length}`);
      console.log(`🎯 Current state: ${context.order_state || "idle"}`);

      // 🔄 Actualizar SOLO el system prompt (primer mensaje) con el estado actualizado
      messages[0] = { role: "system", content: buildSystemPrompt(context) };

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        temperature: 0.5, // ⬆️ Aumentado de 0.3 para evitar loops determinísticos
        max_tokens: 800,
      });

      const assistantMessage = completion.choices[0].message;
      console.log("🤖 AI response:", {
        hasContent: !!assistantMessage.content,
        hasToolCalls: !!assistantMessage.tool_calls,
        toolCallsCount: assistantMessage.tool_calls?.length || 0,
      });

      // Si hay tool calls, ejecutarlos
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 📌 Agregar mensaje del asistente con tool calls
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          // 🛡️ Rate limiting: Prevenir que la misma herramienta se llame múltiples veces
          const callCount = toolCallTracker.get(toolName) || 0;
          if (callCount >= 2) {
            console.warn(`⚠️ Tool ${toolName} called ${callCount} times, forcing text response`);
            continueLoop = false;
            finalResponse = "Disculpá, tuve un problema. ¿Podés reformular tu pedido?";
            break;
          }
          toolCallTracker.set(toolName, callCount + 1);
          
          console.log(`🔧 Executing tool: ${toolName} (call #${callCount + 1})`, toolArgs);

          const toolResult = await ejecutarHerramienta(toolName, toolArgs, context, supabase);
          console.log(`✅ Tool ${toolName} result preview:`, toolResult.slice(0, 100));

          // 📌 Agregar resultado de la herramienta
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        
        // Si se detectó loop, salir
        if (!continueLoop) {
          break;
        }

        // 💾 CRÍTICO: Guardar contexto después de ejecutar todas las herramientas
        console.log(`💾 Saving context after tool execution - vendor_id: ${context.selected_vendor_id}`);
        await saveContext(context, supabase);

        // Continuar el loop para que la IA procese los resultados
        continue;
      }

      // Si no hay tool calls, es la respuesta final
      console.log("✅ No tool calls - AI responding with text");
      console.log("   Content preview:", assistantMessage.content?.slice(0, 200));
      finalResponse = assistantMessage.content || "Perdón, no entendí. ¿Podés repetir?";
      continueLoop = false;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn("⚠️ Max iterations reached, forcing response");
      finalResponse = "Disculpá, tuve un problema procesando tu mensaje. ¿Podés intentar de nuevo?";
    }

    // Agregar respuesta del asistente al historial
    context.conversation_history.push({
      role: "assistant",
      content: finalResponse,
    });

    // Guardar contexto actualizado
    await saveContext(context, supabase);
    console.log("💾 Context saved successfully");

    console.log("🤖 AI Bot END - Returning response");
    return finalResponse;
  } catch (error) {
    console.error("❌ AI Bot ERROR:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return "Disculpá, tuve un problema técnico. Por favor intentá de nuevo en un momento.";
  }
}
