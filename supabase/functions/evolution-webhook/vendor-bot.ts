import OpenAI from "https://esm.sh/openai@4.77.3";
import type { ConversationContext, CartItem } from "./types.ts";
import { normalizeArgentinePhone } from "./utils.ts";
import { getContext, saveContext } from "./context.ts";
import { tools } from "./tools-definitions.ts";

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

        // 🟢 ABIERTOS
        if (openVendors.length > 0) {
          resultado += `🟢 *ABIERTOS AHORA* (${openVendors.length}):\n\n`;
          openVendors.forEach((v: any, i: number) => {
            resultado += `${i + 1}. *${v.vendor_name}*\n`;

            // Dirección y distancia
            const vendorInfo = vendorsInfoMap.get(v.vendor_id);
            console.log(`🔍 Looking for vendor ${v.vendor_id}, found:`, vendorInfo);
            resultado += `📍 ${vendorInfo?.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            resultado += `ID: ${v.vendor_id}\n`;

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
            resultado += `${i + 1}. *${v.vendor_name}* 🔒\n`;

            const vendorInfo = vendorsInfoMap.get(v.vendor_id);
            resultado += `📍 ${vendorInfo?.address || "Dirección no disponible"} - A ${v.distance_km.toFixed(
              1
            )} km\n`;
            resultado += `ID: ${v.vendor_id}\n`;

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

        resultado +=
          "\n💬 Si querés hacer un pedido, decime el nombre o ID del negocio y qué te gustaría pedir. 😊";

        return resultado;
      }


      case "ver_menu_negocio": {
        console.log(`🔍 ========== VER MENU NEGOCIO ==========`);
        console.log(`📝 Args vendor_id: "${args.vendor_id}"`);

        // ⚠️ NOTA: Ya NO limpiamos automáticamente el carrito aquí
        // El bot debe preguntar primero al usuario si quiere cancelar su pedido actual
        // y solo después llamar a vaciar_carrito explícitamente

        // Buscar vendor (por ID o nombre)
        let vendorId = args.vendor_id;
        let vendor: any = null;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(args.vendor_id)) {
          console.log(`🔎 Searching vendor by UUID: ${args.vendor_id}`);
          const { data, error: vendorError } = await supabase.from("vendors").select("id, name, is_active, payment_status").eq("id", args.vendor_id).maybeSingle();
          if (vendorError) console.error("Error finding vendor by ID:", vendorError);
          vendor = data;
        } else {
          const cleanedName = args.vendor_id.replace(/[-_]/g, " ").trim();
          console.log(`🔎 Searching vendor by name: "${cleanedName}"`);
          const { data, error: vendorError } = await supabase
            .from("vendors")
            .select("id, name, is_active, payment_status")
            .ilike("name", `%${cleanedName}%`)
            .maybeSingle();
          if (vendorError) console.error("Error finding vendor by name:", vendorError);
          vendor = data;
          if (vendor) vendorId = vendor.id;
        }

        if (!vendor) {
          console.log(`❌ Vendor not found: ${args.vendor_id}`);
          return "No encontré ese negocio. Por favor usá el ID exacto que te mostré en la lista de locales abiertos.";
        }

        console.log(`✅ Vendor found: ${vendor.id} (${vendor.name}) - Active: ${vendor.is_active}, Payment: ${vendor.payment_status}`);

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

        let menu = `📋 *Menú de ${vendor.name}*\n\n`;
        for (const [i, p] of products.entries()) {
          menu += `${i + 1}. *${p.name}* - $${Math.round(p.price).toLocaleString("es-PY")}\n`;
          if (p.category) menu += `   🏷️ ${Array.isArray(p.category) ? p.category.join(", ") : p.category}\n`;
          if (p.description) menu += `   📝 ${p.description}\n`;
          menu += `\n`;
        }

        console.log(`✅ Menu generated successfully with ${products.length} products`);
        
        // 💾 IMPORTANTE: Guardar el contexto después de seleccionar el negocio
        await saveContext(context, supabase);
        console.log(`💾 Context saved with vendor: ${vendor.name} (${vendor.id})`);
        
        return menu;
      }

      case "agregar_al_carrito": {
        const items = args.items as CartItem[];
        console.log("🛒 ========== AGREGAR AL CARRITO ==========");
        console.log("📦 Items to add:", JSON.stringify(items, null, 2));
        console.log("🔍 Context state:", {
          selected_vendor_id: context.selected_vendor_id,
          selected_vendor_name: context.selected_vendor_name,
          cart_items: context.cart.length,
          args_vendor_id: args.vendor_id
        });

        // SIEMPRE usar el vendor del contexto si existe
        let vendorId: string | undefined = context.selected_vendor_id;
        let vendor: any = null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // Caso 1: Si hay vendor en contexto, validarlo en BD
        if (vendorId) {
          console.log(`✅ Using vendor from context: ${vendorId} (${context.selected_vendor_name})`);
          const { data, error: vendorError } = await supabase
            .from("vendors")
            .select("id, name, is_active, payment_status")
            .eq("id", vendorId)
            .maybeSingle();
          
          if (vendorError) {
            console.error("❌ Error finding vendor by context ID:", vendorError);
          } else if (data) {
            vendor = data;
            console.log(`✅ Vendor found from context: ${vendor.name} (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
          } else {
            console.error(`❌ Vendor ${vendorId} from context not found in database`);
          }
        }
        
        // Caso 2: Si no hay vendor en contexto, intentar con args.vendor_id
        if (!vendor && args.vendor_id) {
          console.log(`⚠️ No vendor in context or vendor not found, trying args.vendor_id: "${args.vendor_id}"`);
          
          if (uuidRegex.test(args.vendor_id)) {
            console.log(`🔍 Searching vendor by UUID from args: ${args.vendor_id}`);
            const { data, error: vendorError } = await supabase
              .from("vendors")
              .select("id, name, is_active, payment_status")
              .eq("id", args.vendor_id)
              .maybeSingle();
            if (vendorError) {
              console.error("❌ Error finding vendor by UUID:", vendorError);
            } else {
              vendor = data;
              console.log(`📦 Vendor found by UUID:`, vendor);
            }
          } else {
            console.log(`🔍 Searching vendor by name from args: "${args.vendor_id}"`);
            const cleanedName = (args.vendor_id || "").replace(/[-_]/g, " ").trim();
            const { data, error: vendorError } = await supabase
              .from("vendors")
              .select("id, name, is_active, payment_status")
              .ilike("name", `%${cleanedName}%`)
              .maybeSingle();
            if (vendorError) {
              console.error("❌ Error finding vendor by name:", vendorError);
            } else {
              vendor = data;
              console.log(`📦 Vendor found by name:`, vendor);
            }
          }
        }

        // Validar que el vendor existe y está activo
        if (!vendor) {
          console.error(`❌ ===== VENDOR NOT FOUND =====`);
          console.error(`Context vendor_id: ${context.selected_vendor_id}`);
          console.error(`Context vendor_name: ${context.selected_vendor_name}`);
          console.error(`Args vendor_id: ${args.vendor_id}`);
          
          // Buscar si hay mención de vendor en el historial reciente
          const recentMessages = context.conversation_history.slice(-5);
          const vendorMentioned = recentMessages.some((msg: any) => 
            msg.role === 'assistant' && (
              msg.content.includes('Heladería') || 
              msg.content.includes('Farmacia') ||
              msg.content.includes('negocio') || 
              msg.content.includes('local')
            )
          );
          
          if (vendorMentioned && context.selected_vendor_name) {
            return `⚠️ Parece que mencionaste *${context.selected_vendor_name}* pero necesito mostrar el menú primero para poder agregar productos.\n\n¿Querés que te muestre el menú de *${context.selected_vendor_name}*? Así podés elegir qué productos agregar. 😊`;
          }
          
          return `❌ No pude encontrar el negocio para agregar productos.\n\n💡 Posibles causas:\n- No seleccionaste un negocio todavía\n- El negocio cerró temporalmente\n\nPor favor pedime ver los negocios disponibles:\n"Ver locales abiertos"`;
        }
        
        if (!vendor.is_active || vendor.payment_status !== 'active') {
          console.error(`❌ Vendor ${vendor.name} is not available (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
          return `❌ El negocio "${vendor.name}" no está disponible en este momento.\n\nPor favor elegí otro negocio de los disponibles.`;
        }

        vendorId = vendor.id;
        console.log(`✅ ===== VENDOR VALIDATED: ${vendor.name} (${vendorId}) =====`);

        // 🧹 Si el carrito es de otro negocio, vaciarlo
        if (context.cart.length > 0 && context.selected_vendor_id && vendorId !== context.selected_vendor_id) {
          console.log(`🗑️ Cambiaste de negocio: ${context.selected_vendor_id} → ${vendorId}. Vaciando carrito.`);
          context.cart = [];
        }
        
        // Actualizar vendor seleccionado (ya validado)
        context.selected_vendor_id = vendorId;
        context.selected_vendor_name = vendor.name;

        // Resolver productos
        const resolvedItems: CartItem[] = [];
        for (const item of items) {
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
            resolvedItems.push({
              product_id: product.id,
              product_name: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          }
        }

        if (!resolvedItems.length) {
          return "❌ No pude encontrar esos productos en el menú.";
        }

        // Agregar productos validados
        for (const item of resolvedItems) {
          const existing = context.cart.find((c) => c.product_id === item.product_id);
          if (existing) existing.quantity += item.quantity;
          else context.cart.push(item);
        }

        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        return `✅ Productos agregados al carrito de ${context.selected_vendor_name}.\n💰 Total actual: $${total}`;
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return "El carrito está vacío.";
        }

        let carrito = "🛒 Tu carrito:\n\n";
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        carrito += `\n💰 Total: $${total}`;

        return carrito;
      }

      case "vaciar_carrito": {
        context.cart = [];
        return "🗑️ Carrito vaciado";
      }

      case "quitar_producto_carrito": {
        const index = context.cart.findIndex((item) => item.product_id === args.product_id);
        if (index !== -1) {
          const removed = context.cart.splice(index, 1)[0];
          return `Quité ${removed.product_name} del carrito`;
        }
        return "Producto no encontrado en el carrito";
      }

      case "crear_pedido": {
        console.log("🛒 crear_pedido called with context:", {
          cartLength: context.cart.length,
          cartPreview: context.cart.map((i) => `${i.product_name} x${i.quantity}`).join(", "),
          vendorId: context.selected_vendor_id,
          vendorName: context.selected_vendor_name,
          address: args.direccion,
          paymentMethod: args.metodo_pago,
          userLocation: context.user_latitude ? `${context.user_latitude},${context.user_longitude}` : "none",
        });

        if (context.cart.length === 0) {
          return "No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?";
        }

        if (!context.selected_vendor_id) {
          console.error("❌ No vendor_id in context!");
          return "Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.";
        }

        // 📍 VALIDACIÓN DE UBICACIÓN Y COBERTURA
        let deliveryCost = 0;
        let deliveryDistance = 0;

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
              console.log(`📏 Distance: ${distanceResult}km, Max: ${vendor.delivery_radius_km}km`);

              if (distanceResult > vendor.delivery_radius_km) {
                return `😔 Lo siento, ${vendor.name} no hace delivery a tu ubicación.\n\n📍 Tu ubicación está a ${distanceResult.toFixed(1)} km del local.\n🚗 Radio de cobertura: ${vendor.delivery_radius_km} km\n\n💡 Podés buscar otros negocios más cercanos o actualizar tu ubicación.`;
              }

              // Calcular costo de delivery según el tipo de pricing
              const pricingType = vendor.delivery_pricing_type || 'per_km';
              
              if (pricingType === 'fixed') {
                deliveryCost = vendor.delivery_fixed_price || 0;
              } else if (pricingType === 'base_plus_km') {
                const basePrice = vendor.delivery_fixed_price || 0;
                const additionalPerKm = vendor.delivery_additional_per_km || 0;
                const additionalDistance = Math.max(0, distanceResult - 1);
                deliveryCost = basePrice + (additionalDistance * additionalPerKm);
              } else {
                // per_km
                if (vendor.delivery_price_per_km && vendor.delivery_price_per_km > 0) {
                  deliveryCost = distanceResult * vendor.delivery_price_per_km;
                }
              }
              
              deliveryCost = Math.round(deliveryCost);
              console.log(`🚚 Delivery cost: ${deliveryCost} $ (Type: ${pricingType}, Distance: ${distanceResult}km)`);
            }
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
          // Sin ubicación, pedir que la comparta
          if (!args.direccion || args.direccion.trim() === "") {
            return `📍 Para confirmar tu pedido, necesito que compartas tu ubicación.\n\n👉 Tocá el clip 📎 en WhatsApp y elegí "Ubicación"\n\nAsí puedo verificar que ${context.selected_vendor_name} hace delivery a tu zona. 🚗`;
          }
        }

        // 🚫 Verificar si el usuario ya tiene un pedido activo (SIEMPRE desde BD)
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id, status, vendor_id")
          .eq("customer_phone", context.phone)
          .in("status", ["pending", "confirmed", "preparing", "ready", "delivering"])
          .order("created_at", { ascending: false });

        if (activeOrders && activeOrders.length > 0) {
          // Validar que el vendor del pedido activo todavía existe
          const validActiveOrders = [];
          
          for (const order of activeOrders) {
            const { data: vendor } = await supabase
              .from("vendors")
              .select("id, name, is_active")
              .eq("id", order.vendor_id)
              .maybeSingle();
            
            if (vendor && vendor.is_active) {
              validActiveOrders.push({ ...order, vendor_name: vendor.name });
            } else {
              // El vendor ya no existe, cancelar pedido automáticamente
              console.log(`⚠️ Vendor ${order.vendor_id} no longer exists, auto-cancelling order ${order.id}`);
              await supabase
                .from("orders")
                .update({ 
                  status: "cancelled",
                  notes: "Pedido cancelado automáticamente: negocio ya no disponible"
                })
                .eq("id", order.id);
            }
          }
          
          if (validActiveOrders.length > 0) {
            const order = validActiveOrders[0];
            return `⚠️ Ya tenés un pedido en curso (#${order.id.substring(0, 8)}) con ${order.vendor_name} en estado "${order.status}".\n\nPor favor esperá a que se complete o cancele ese pedido antes de hacer uno nuevo.`;
          }
        }

        // Validar que la dirección y método de pago estén presentes
        if (!args.direccion || args.direccion.trim() === "") {
          return "Por favor indicá tu dirección de entrega.";
        }

        if (!args.metodo_pago) {
          return "Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).";
        }

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
            address_is_manual: !context.user_latitude || context.user_latitude === 0, // Marca si es manual
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
        confirmacion += `🏪 Negocio: ${context.selected_vendor_name}\n`;

        if (deliveryCost > 0) {
          confirmacion += `🛒 Subtotal: $ ${Math.round(subtotal).toLocaleString("es-PY")}\n`;
          confirmacion += `🚚 Delivery (${deliveryDistance.toFixed(1)} km): $ ${Math.round(deliveryCost).toLocaleString("es-PY")}\n`;
          confirmacion += `💰 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n`;
        } else {
          confirmacion += `💰 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n`;
        }

        confirmacion += `📍 Dirección: ${context.delivery_address}\n`;
        confirmacion += `💳 Pago: ${context.payment_method}\n\n`;

        if (context.payment_method === "transferencia") {
          confirmacion += `Por favor enviá el comprobante de pago para confirmar el pedido.`;
        }

        // Limpiar carrito después de crear pedido
        context.cart = [];

        return confirmacion;
      }

      case "ver_estado_pedido": {
        const { data: order, error } = await supabase
          .from("orders")
          .select("*, vendors(name)")
          .eq("id", args.order_id)
          .single();

        if (error || !order) {
          return "No encontré ese pedido";
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

        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", args.order_id)
          .single();

        if (fetchError || !order) {
          return "No encontré ese pedido.";
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
          .eq("id", args.order_id);

        if (updateError) {
          return "Hubo un error al cancelar el pedido. Intenta de nuevo.";
        }

        // Registrar historial
        await supabase.from("order_status_history").insert({
          order_id: args.order_id,
          status: "cancelled",
          changed_by: "customer",
          reason: args.motivo,
        });

        // 📧 Notificar al vendedor sobre la cancelación
        try {
          await supabase.functions.invoke("notify-vendor", {
            body: {
              orderId: args.order_id,
              eventType: "order_cancelled",
            },
          });
        } catch (notifyError) {
          console.error("Error notifying vendor about cancellation:", notifyError);
        }

        return `✅ Pedido #${args.order_id.substring(0, 8)} cancelado.\n📝 Motivo: ${args.motivo}\n\nEl vendedor ha sido notificado.`;
      }

      case "ver_metodos_pago": {
        // Verificar que hay un negocio seleccionado
        if (!context.selected_vendor_id) {
          return "Primero tenés que elegir un negocio. ¿Querés ver los negocios disponibles?";
        }

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
        let datosTransferencia = "";

        // Verificar cada método
        if (paymentSettings.efectivo === true) {
          metodosDisponibles.push("- Efectivo 💵");
        }

        if (paymentSettings.transferencia?.activo === true) {
          metodosDisponibles.push("- Transferencia bancaria 🏦");
          
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
        }

        if (metodosDisponibles.length === 0) {
          return `⚠️ ${vendor.name} todavía no configuró métodos de pago. Por favor contactá directamente con el negocio.`;
        }

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
    
    // 🧹 LIMPIAR CONTEXTO si hay un pedido entregado/cancelado DEL MISMO VENDOR O si el vendor ya no existe
    if (context.selected_vendor_id || context.cart.length > 0) {
      console.log('🔍 Validating context data...');
      let shouldClearContext = false;
      
      // Verificar si hay pedidos completados DEL MISMO VENDOR
      if (context.selected_vendor_id) {
        const { data: completedOrders } = await supabase
          .from('orders')
          .select('id, status, created_at, vendor_id')
          .eq('customer_phone', normalizedPhone)
          .eq('vendor_id', context.selected_vendor_id)
          .in('status', ['delivered', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (completedOrders && completedOrders.length > 0) {
          console.log(`✅ Found completed order from same vendor: ${completedOrders[0].id} (${completedOrders[0].status})`);
          shouldClearContext = true;
        }
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
        console.log('🧹 Clearing context...');
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.pending_order_id = undefined;
        
        await saveContext(context, supabase);
        console.log('✅ Context cleared');
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
      
      // Limpiar pending_order_id del contexto
      context.pending_order_id = undefined;
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

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({
      role: "user",
      content: message,
    });

    // Inicializar OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    // Prompt del sistema
    const systemPrompt = `Sos un vendedor de Lapacho, una plataforma de delivery por WhatsApp en Argentina.

Tu trabajo es ayudar a los clientes a hacer pedidos de forma natural y amigable.

INFORMACIÓN DEL CONTEXTO:
${context.selected_vendor_name ? `- Negocio actual: ${context.selected_vendor_name}` : ""}
${context.cart.length > 0 ? `- Carrito: ${context.cart.map((i) => `${i.quantity}x ${i.product_name} ($${i.price})`).join(", ")} - Total: $${context.cart.reduce((s, i) => s + i.price * i.quantity, 0)}` : "- Carrito vacío"}
${context.delivery_address ? `- Dirección: ${context.delivery_address}` : ""}
${context.payment_method ? `- Método de pago: ${context.payment_method}` : ""}
${context.pending_order_id ? `- Pedido pendiente: ${context.pending_order_id}` : ""}
${context.user_latitude && context.user_longitude ? `- ✅ Usuario tiene ubicación guardada (lat: ${context.user_latitude}, lng: ${context.user_longitude})` : "- ⚠️ Usuario NO compartió su ubicación aún"}

🚨 DATOS EN TIEMPO REAL (MÁXIMA PRIORIDAD):
⚠️ NUNCA ALMACENES NI MEMORICES INFORMACIÓN DE NEGOCIOS ⚠️
- Los negocios pueden cambiar HORARIOS, PRODUCTOS, PRECIOS y DISPONIBILIDAD en cualquier momento
- Un negocio puede estar SUSPENDIDO por falta de pago
- Los productos disponibles varían según STOCK actual
- El RADIO DE ENTREGA puede cambiar según ubicación del cliente
- SIEMPRE debes consultar las herramientas para obtener información actualizada
- NO supongas que un negocio que aparecía antes todavía está disponible
- NO memorices menús, precios o productos - todo cambia dinámicamente

📍 UBICACIÓN Y FILTRADO:
${context.user_latitude && context.user_longitude
        ? "- El usuario YA compartió su ubicación → Solo verá negocios que entregan en su zona"
        : "- El usuario NO compartió ubicación → Verá todos los negocios, pero es recomendable pedirle que la comparta"
      }
- Si el usuario pregunta por delivery o zona: explicale que puede compartir su ubicación usando el botón 📍 de WhatsApp
- Cuando el usuario busque locales o productos, automáticamente se filtrarán por su ubicación si la compartió
- Si el usuario está buscando y no tiene ubicación, sugerile compartirla para ver solo lo que está a su alcance
- ⚠️ CRÍTICO: Cuando muestres negocios, SIEMPRE incluí la distancia si la herramienta la proporciona. No la elimines ni la omitas al reformular el mensaje.

REGLAS CRÍTICAS SOBRE HERRAMIENTAS (MÁXIMA PRIORIDAD):
🚨 **PROHIBIDO MODIFICAR RESULTADOS DE HERRAMIENTAS** 🚨
Cuando una herramienta devuelve un resultado:
- **COPIÁ TODO EL TEXTO TAL CUAL ESTÁ**
- **NO CAMBIES NINGÚN DATO**: ni direcciones, ni distancias, ni precios, ni nombres
- **NO AGREGUES información** del contexto del usuario
- **NO RESUMAS** el resultado
- **NO REFORMULES** el formato

Ejemplo CORRECTO:
Herramienta devuelve: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"
TU respuesta: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"

Ejemplo INCORRECTO:
Herramienta devuelve: "1. Pizzería Don Luigi\n   📍 Av. España 1234 - A 0.5 km"
TU respuesta: "1. Pizzería Don Luigi\n   📍 LAVALLE 1582"  ❌ NUNCA HAGAS ESTO

REGLAS GENERALES:
1. Hablá en argentino informal pero respetuoso (vos, querés, podés, etc)
2. Usá emojis para hacer la conversación más amigable
3. Sé breve y directo - máximo 4 líneas por mensaje
4. ⚠️ NUNCA inventes productos, precios o información que no existe en la base de datos
5. Si no sabés algo, decilo y preguntá
6. Cuando el cliente busque algo, usá la herramienta buscar_productos
8. ⚠️ CRÍTICO - VER MENÚ Y CAMBIO DE NEGOCIO:
   
   **Si el cliente pide ver menú de un negocio DIFERENTE al que tiene carrito:**
   - ⚠️ IMPORTANTE: ANTES de decirle que tiene un pedido activo, SIEMPRE verifica:
     1. Usa la herramienta ver_estado_pedido para confirmar que realmente tiene un pedido activo
     2. Si NO hay pedido activo en la BD, ignora el contexto y procede normalmente
   - Si SÍ hay un pedido activo confirmado:
     - Avisale: "Tenés un pedido activo con [negocio del pedido]. ¿Querés cancelarlo para ver el menú de [nuevo negocio]?"
     - ⚠️ ESPERA CONFIRMACIÓN DEL USUARIO (sí, dale, ok, etc.)
     - Si confirma → LLAMAR vaciar_carrito() primero, LUEGO ver_menu_negocio
     - Si NO confirma → mantener contexto actual
   - Si NO hay pedido activo pero SÍ hay carrito:
     - Simplemente pregunta: "Tenés productos en el carrito de [negocio]. ¿Los querés borrar para ver el menú de [nuevo negocio]?"
     - Si confirma → vaciar_carrito() + ver_menu_negocio
   
   **Si NO hay carrito ni pedido activo:**
   - SIEMPRE usa la herramienta ver_menu_negocio directamente
   - NUNCA respondas sin consultar la herramienta primero
   
   Ejemplos:
   ✅ "ver menú" (sin carrito) → Preguntar cuál negocio o usar contexto si existe
   ✅ "ver menú" (con carrito de "Pizzería X") → Verificar pedido activo → Si no hay, preguntar si quiere borrar carrito
   ✅ "menú de farmacia" (carrito: "Restaurant") → Verificar pedido activo primero con ver_estado_pedido
   ❌ NUNCA: Decir "tenés un pedido activo" sin llamar a ver_estado_pedido antes
9. Cuando uses ver_menu_negocio, los datos que devuelve son EN TIEMPO REAL - no memorices productos ni precios
10. SOLO podés agregar productos que aparecen en el menú que mostraste
11. Si el cliente pregunta por el estado de un pedido, usá ver_estado_pedido
12. Si el cliente pide ayuda o pregunta qué puede hacer, usá mostrar_menu_ayuda
13. Cuando el cliente quiera calificar su experiencia de pedido, usá registrar_calificacion
14. Cuando el cliente quiera calificar la plataforma Lapacho en general, usá calificar_plataforma
15. NUNCA muestres múltiples menús en una sola respuesta - solo UN menú a la vez

⚠️ PRODUCTOS Y CARRITO (CRÍTICO):
✅ **USA LOS NOMBRES EXACTOS DE LOS PRODUCTOS DEL MENÚ**
- Cuando muestres el menú con ver_menu_negocio, vas a recibir algo así:
  "1. Ibuprofeno 400mg - $18000
      🏷️ Analgésicos"
- Para agregar productos al carrito, DEBÉS usar el nombre EXACTO que aparece en el menú
- ✅ SIEMPRE copiá el nombre completo como aparece: "Ibuprofeno 400mg"
- ❌ NUNCA modifiques el nombre del producto

Ejemplos CORRECTOS:
✅ Cliente: "quiero 2 ibuprofenos"
   Menú mostrado: "1. Ibuprofeno 400mg - $18000"
   → agregar_al_carrito con product_id="Ibuprofeno 400mg", product_name="Ibuprofeno 400mg", quantity=2, price=18000

✅ Cliente: "un agua"
   Menú mostrado: "5. Agua Mineral - $5000"
   → agregar_al_carrito con product_id="Agua Mineral", product_name="Agua Mineral", quantity=1, price=5000

Ejemplos INCORRECTOS:
❌ agregar_al_carrito con product_id="ibuprofeno" (falta "400mg")
❌ agregar_al_carrito con product_id="Ibuprofeno"
❌ agregar_al_carrito con product_id="agua_mineral"

⚠️ VENDOR_ID:
- Cuando uses ver_menu_negocio, el vendor_id se guarda automáticamente en el contexto
- NO necesitás pasar vendor_id en agregar_al_carrito (se usa el del contexto automáticamente)
- Si el contexto no tiene vendor_id, primero mostrá el menú con ver_menu_negocio

⚠️ REGLA CRÍTICA - NUNCA SUGERIR PRODUCTOS SIN MENÚ PRIMERO:
- PROHIBIDO absolutamente sugerir productos específicos si NO has llamado a ver_menu_negocio antes
- Si el cliente menciona productos pero NO tienes selected_vendor_id en el contexto:
  1. PRIMERO llamá a ver_menu_negocio para obtener el menú REAL
  2. DESPUÉS confirmá si los productos que mencionó están disponibles
- Esta regla aplica SIEMPRE, incluso si el cliente parece saber qué productos quiere
- Ejemplo INCORRECTO:
  ❌ Cliente: "quiero helados" → Bot: "¿Te gustaría que agregue dos helados de chocolate?" (SIN haber mostrado menú)
- Ejemplo CORRECTO:
  ✅ Cliente: "quiero helados" → Bot llama ver_locales_abiertos → Cliente: "la heladería italiana" → Bot DEBE llamar ver_menu_negocio → Muestra menú real → "¿Qué helados te gustaría pedir?"

Si el cliente pide algo que NO existe en el menú → Decile que NO lo tenés y mostrá alternativas

⚠️ CREAR PEDIDO vs HABLAR CON VENDEDOR:
- CREAR PEDIDO (crear_pedido): cuando el cliente confirma que TODO está correcto (carrito, dirección, pago)
  Ejemplos: "sí", "correcto", "confirmo", "dale", "está bien", "todo ok", "perfecto"
- HABLAR CON VENDEDOR (hablar_con_vendedor): SOLO cuando el cliente pide explícitamente hablar con el negocio
  Ejemplos: "quiero hablar con el vendedor", "necesito consultar algo", "tengo una duda para el negocio"
  
⚠️ IMPORTANTE: Si el carrito tiene productos, dirección y método de pago, y el cliente confirma → SIEMPRE usar crear_pedido

⚠️ MÉTODOS DE PAGO (CRÍTICO):
- Antes de confirmar un pedido o preguntar por método de pago, SIEMPRE usá ver_metodos_pago
- NUNCA menciones métodos de pago que el negocio no tiene habilitados
- NUNCA digas "efectivo, transferencia o mercadopago" sin verificar primero
- Si el cliente confirma dirección → PRIMERO ver_metodos_pago, DESPUÉS preguntar cuál prefiere
- La herramienta ver_metodos_pago YA incluye los datos bancarios (alias, CBU, titular) cuando transferencia está disponible
- NO necesitás consultar los datos por separado - ver_metodos_pago devuelve TODO
- Ejemplos:
  ✅ Cliente: "confirmo dirección" → ver_metodos_pago + mostrar opciones REALES (incluye datos bancarios si aplica)
  ❌ "¿Qué método de pago preferís? (efectivo, transferencia o mercadopago)" SIN llamar a ver_metodos_pago
  ✅ Respuesta correcta: "Tenés disponible: - Efectivo 💵\n- Transferencia bancaria 🏦\n\n📋 Datos para transferencia:\n• Alias: negocio.mp\n• CBU/CVU: 0000003..."

FLUJO OBLIGATORIO:
1. Cliente busca algo → buscar_productos o ver_locales_abiertos
2. Mostrás resultados con lista de negocios
3. Cliente debe ELEGIR un negocio específico (por nombre o ID)
4. SOLO DESPUÉS de que elija → ver_menu_negocio con el vendor_id correcto
5. Cliente elige productos DEL MENÚ → agregar_al_carrito (SOLO productos que mostraste)
6. Preguntás dirección y método de pago (ver sección 📍 UBICACIÓN abajo)
7. Confirmás datos → crear_pedido

⚠️ IMPORTANTE: NO uses ver_menu_negocio hasta que el cliente especifique cuál negocio quiere ver

📍 UBICACIÓN Y DIRECCIÓN:
${context.user_latitude && context.user_longitude && context.user_latitude !== 0
        ? "- ✅ El usuario YA tiene ubicación → crear_pedido la usará automáticamente"
        : '- ⚠️ El usuario NO tiene ubicación GPS. Opciones:\n  1. IDEAL: "📍 Compartí tu ubicación tocando el clip 📎 en WhatsApp" (valida radio)\n  2. ALTERNATIVA: Usar agregar_direccion_manual si el cliente no puede compartir GPS\n  ⚠️ Las direcciones manuales NO validan radio de entrega - el negocio debe confirmar'
      }
- Una vez que tengas ubicación GPS, crear_pedido validará si el negocio hace delivery a su zona
- Si está fuera de cobertura, el sistema le avisará automáticamente
- ⚠️ Direcciones manuales (sin GPS): El negocio verá una marca especial indicando que debe confirmar cobertura

📍 GESTIÓN DE DIRECCIONES GUARDADAS:
- Cuando el usuario comparta una ubicación 📍, preguntale SIEMPRE:
  "Recibí tu ubicación 📍 [dirección si está disponible]
   ¿Querés usarla solo para este pedido o guardarla para la próxima?
   
   Escribí:
   • TEMP — usar solo para este pedido (se eliminará automáticamente)
   • GUARDAR [nombre] — guardarla con un nombre (ej: Casa, Trabajo)"

- Si el cliente NO puede compartir ubicación GPS:
  • "Escribí tu dirección" → agregar_direccion_manual
  • Ejemplo: "Av. San Martín 1234, Rosario" sin nombre = temporal
  • Ejemplo: "Av. San Martín 1234, Rosario" + "Casa" = guardada

- El cliente puede decir cosas como:
  • "Enviar a Casa" → usar_direccion_guardada
  • "Mis direcciones" → listar_direcciones
  • "Borrar Casa" → borrar_direccion
  • "Renombrar Casa Oficina" → renombrar_direccion
  • "Eliminar mis direcciones" → eliminar_todas_direcciones

- Siempre confirmar acciones de forma natural y amigable
- Recordar que las ubicaciones temporales se eliminan automáticamente

CALIFICACIONES:
- Cuando un cliente quiera calificar, preguntale por separado:
  🚚 Tiempo de entrega (1-5)
  👥 Atención del vendedor (1-5)
  📦 Calidad del producto (1-5)
  💬 Comentario opcional
- Puede dar una o todas las calificaciones
- Siempre agradecé su opinión

💰 COSTO DE DELIVERY:
- Si el cliente pregunta "¿Cuánto me sale el delivery?", "¿Cuál es el costo de envío?" o similar → usar calcular_costo_delivery
- Esta herramienta calculará automáticamente el costo basado en la distancia
- Si el cliente NO tiene ubicación, pedile que la comparta primero
- Algunos negocios tienen delivery gratis (precio $ 0/km) y otros cobran por distancia
- El costo se suma al total del pedido al confirmar

IMPORTANTE: Siempre confirmá antes de crear un pedido. Preguntá dirección y método de pago solo cuando el cliente esté listo para finalizar.`;

    // Preparar mensajes para la API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...context.conversation_history.slice(-15), // Últimos 15 mensajes para no saturar
    ];

    console.log("🔄 Calling OpenAI with", messages.length, "messages...");

    let continueLoop = true;
    let finalResponse = "";
    let iterationCount = 0;
    const MAX_ITERATIONS = 5; // Prevenir loops infinitos

    // Loop de conversación con tool calling
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`🔁 Iteration ${iterationCount}...`);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        temperature: 0.3,
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
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          console.log(`🔧 Executing tool: ${toolName}`, toolArgs);

          const toolResult = await ejecutarHerramienta(toolName, toolArgs, context, supabase);
          console.log(`✅ Tool result preview:`, toolResult.slice(0, 100));

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // Continuar el loop para que la IA procese los resultados
        continue;
      }

      // Si no hay tool calls, es la respuesta final
      console.log("❌ No tool calls - AI responding directly");
      console.log("   Message content:", assistantMessage.content?.slice(0, 200));
      finalResponse = assistantMessage.content || "Perdón, no entendí. ¿Podés repetir?";
      console.log("✅ Final response ready:", finalResponse.slice(0, 100));
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
