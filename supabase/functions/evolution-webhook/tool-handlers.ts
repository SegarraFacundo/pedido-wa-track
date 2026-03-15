// ==================== EJECUTORES DE HERRAMIENTAS ====================

import { ConversationContext, CartItem, getPendingStateForPayment } from "./types.ts";
import { saveContext } from "./context.ts";
import { getVendorConfig } from "./bot-helpers.ts";
import { t, Language } from "./i18n.ts";

export async function ejecutarHerramienta(
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

        const { data, error } = await supabase.functions.invoke("search-products", {
          body: { searchQuery: args.consulta },
        });

        console.log("Search products result:", JSON.stringify(data, null, 2));

        if (error || !data?.found) {
          return `No encontré negocios abiertos con "${args.consulta}".`;
        }

        const vendorMap: Array<{ index: number; name: string; vendor_id: string }> = [];
        let resultado = `Encontré estos negocios con "${args.consulta}":\n\n`;
        data.results.forEach((r: any, i: number) => {
          const idx = i + 1;
          resultado += `${idx}. *${r.vendor.name}*\n`;
          r.products.forEach((p: any) => {
            resultado += `   - ${p.name} - $${p.price}\n`;
          });
          resultado += `\n`;
          vendorMap.push({ index: idx, name: r.vendor.name, vendor_id: r.vendor.id });
        });

        context.available_vendors_map = vendorMap;
        context.last_vendors_fetch = new Date().toISOString();
        await saveContext(context, supabase);

        resultado += `Decime el número o nombre del negocio para ver su menú completo.`;
        return resultado;
      }

      case "ver_locales_abiertos": {
        // 🚫 Validar que no haya pedido activo
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }
        
        const now = new Date();
        const argentinaTime = new Date(
          now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
        );
        const currentDay = [
          "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
        ][argentinaTime.getDay()];
        console.log(`🕐 Día actual: ${currentDay}`);

        const { data: vendorsInRange, error } = await supabase
          .from("vendors")
          .select("id, name, address, average_rating, total_reviews, is_active, allows_delivery, allows_pickup")
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching vendors:", error);
          return "⚠️ Ocurrió un error al buscar negocios. Intentalo nuevamente.";
        }

        if (!vendorsInRange || vendorsInRange.length === 0) {
          return "😔 No hay negocios disponibles en este momento.";
        }
        
        const vendorIds = vendorsInRange.map((v: any) => v.id);
        const { data: vendorHours, error: hoursError } = await supabase
          .from("vendor_hours")
          .select("vendor_id, day_of_week, opening_time, closing_time, is_closed, is_open_24_hours")
          .in("vendor_id", vendorIds)
          .eq("day_of_week", currentDay);

        if (hoursError) console.error("Error obteniendo horarios:", hoursError);

        const hoursMap = new Map();
        vendorHours?.forEach((h: any) => {
          if (!hoursMap.has(h.vendor_id)) hoursMap.set(h.vendor_id, []);
          hoursMap.get(h.vendor_id).push(h);
        });

        const currentTimeStr = argentinaTime.toTimeString().slice(0, 5);
        
        const isVendorOpen = (vendorId: string): boolean => {
          const todayHours = hoursMap.get(vendorId);
          if (!todayHours || todayHours.length === 0) return true;
          
          return todayHours.some((h: any) => {
            if (h.is_closed) return false;
            if (h.is_open_24_hours) return true;
            return currentTimeStr >= h.opening_time.slice(0, 5) && currentTimeStr <= h.closing_time.slice(0, 5);
          });
        };

        const openVendors = vendorsInRange.filter((v: any) => isVendorOpen(v.id));
        const closedVendors = vendorsInRange.filter((v: any) => !isVendorOpen(v.id));

        let resultado = "¡Aquí tenés los negocios disponibles! 🚗\n\n";

        const vendorMap: Array<{ index: number; name: string; vendor_id: string }> = [];
        let currentIndex = 1;

        if (openVendors.length > 0) {
          resultado += `🟢 *ABIERTOS AHORA* (${openVendors.length}):\n\n`;
          openVendors.forEach((v: any) => {
            resultado += `${currentIndex}. *${v.name}*\n`;
            resultado += `📍 ${v.address || "Dirección no disponible"}\n`;
            
            vendorMap.push({ index: currentIndex, name: v.name, vendor_id: v.id });
            currentIndex++;

            const todayHours = hoursMap.get(v.id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              if (slots.length > 0) resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            }

            if (v.average_rating && v.total_reviews)
              resultado += `⭐ Rating: ${v.average_rating.toFixed(1)} (${v.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        if (closedVendors.length > 0) {
          resultado += `🔴 *CERRADOS* (${closedVendors.length}):\n\n`;
          closedVendors.forEach((v: any) => {
            resultado += `${currentIndex}. *${v.name}* 🔒\n`;
            resultado += `📍 ${v.address || "Dirección no disponible"}\n`;
            
            vendorMap.push({ index: currentIndex, name: v.name, vendor_id: v.id });
            currentIndex++;

            const todayHours = hoursMap.get(v.id);
            if (todayHours && todayHours.length > 0) {
              const slots = todayHours
                .filter((h: any) => !h.is_closed)
                .map((h: any) =>
                  h.is_open_24_hours
                    ? "24 hs"
                    : `${h.opening_time.slice(0, 5)} - ${h.closing_time.slice(0, 5)}`
                );
              if (slots.length > 0) resultado += `⏰ Horario: ${slots.join(", ")}\n`;
            }

            if (v.average_rating && v.total_reviews)
              resultado += `⭐ Rating: ${v.average_rating.toFixed(1)} (${v.total_reviews} reseñas)\n`;

            resultado += `\n`;
          });
        }

        context.available_vendors_map = vendorMap;
        context.last_vendors_fetch = new Date().toISOString();
        const oldState = context.order_state || "idle";
        context.order_state = "browsing";
        console.log(`🔄 STATE: ${oldState} → browsing (ver_locales_abiertos)`);
        await saveContext(context, supabase);

        const timeStr = argentinaTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        resultado += `\n\n_🕒 Datos actualizados a las ${timeStr}_`;
        resultado += "\n💬 Decime el *número* o *nombre* del negocio para ver su menú. 😊";

        return resultado;
      }

      case "ver_menu_negocio": {
        console.log(`🔍 ========== VER MENU NEGOCIO ==========`);
        console.log(`📝 Args vendor_id: "${args.vendor_id}"`);

        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }

        const currentState = context.order_state || "idle";
        if (currentState === "idle") {
          context.order_state = "browsing";
          await saveContext(context, supabase);
        }

        const searchVendor = async (searchTerm: string) => {
          if (context.available_vendors_map && context.available_vendors_map.length > 0) {
            console.log("🔍 Buscando en mapa de vendors disponibles:", context.available_vendors_map.length);
            
            const indexNum = parseInt(searchTerm);
            if (!isNaN(indexNum)) {
              const byIndex = context.available_vendors_map.find(v => v.index === indexNum);
              if (byIndex) {
                console.log(`✅ Vendor encontrado por índice ${indexNum}:`, byIndex.name);
                const { data } = await supabase.from("vendors")
                  .select("id, name, is_active, payment_status")
                  .eq("id", byIndex.vendor_id)
                  .maybeSingle();
                if (data) return data;
              }
            }
            
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
          
          console.log("🔍 Búsqueda con normalización de acentos");
          const normalizedAccent = cleaned
            .replace(/[áàäâã]/gi, 'a')
            .replace(/[éèëê]/gi, 'e')
            .replace(/[íìïî]/gi, 'i')
            .replace(/[óòöôõ]/gi, 'o')
            .replace(/[úùüû]/gi, 'u')
            .replace(/[ñ]/gi, 'n')
            .toLowerCase();
          
          const { data: allVendors } = await supabase.from("vendors")
            .select("id, name, is_active, payment_status")
            .eq("is_active", true);
          
          const found = allVendors?.find((v: any) => {
            const vendorNormalized = v.name
              .replace(/[áàäâã]/gi, 'a')
              .replace(/[éèëê]/gi, 'e')
              .replace(/[íìïî]/gi, 'i')
              .replace(/[óòöôõ]/gi, 'o')
              .replace(/[úùüû]/gi, 'u')
              .replace(/[ñ]/gi, 'n')
              .toLowerCase();
            return vendorNormalized.includes(normalizedAccent);
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
          
          context.pending_vendor_change = {
            new_vendor_id: vendor.id,
            new_vendor_name: vendor.name
          };
          
          await saveContext(context, supabase);
          
          const currentTotal = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
          
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

        context.selected_vendor_id = vendor.id;
        context.selected_vendor_name = vendor.name;
        console.log(`💾 Context updated - Vendor: ${context.selected_vendor_name} (${context.selected_vendor_id})`);

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

        const { data: vendorDetails } = await supabase
          .from("vendors")
          .select("allows_pickup, allows_delivery, pickup_instructions, address")
          .eq("id", vendor.id)
          .single();
        
        if (vendorDetails) {
          context.vendor_allows_pickup = vendorDetails.allows_pickup === true;
          context.vendor_allows_delivery = vendorDetails.allows_delivery ?? true;
          context.pickup_instructions = vendorDetails.pickup_instructions;
          console.log(`✅ Delivery options: allows_delivery=${context.vendor_allows_delivery}, allows_pickup=${context.vendor_allows_pickup}`);
        } else {
          context.vendor_allows_pickup = false;
          context.vendor_allows_delivery = true;
        }

        let menu = `*${vendor.name}*\n`;
        
        if (context.vendor_allows_delivery && context.vendor_allows_pickup) {
          menu += `📍 ${vendorDetails?.address || ''} | 🚚 Delivery y 🏪 Retiro\n\n`;
        } else if (context.vendor_allows_pickup && !context.vendor_allows_delivery) {
          menu += `📍 ${vendorDetails?.address || ''} | Solo 🏪 Retiro\n\n`;
        } else {
          menu += `Solo 🚚 Delivery\n\n`;
        }
        
        for (const [i, p] of products.entries()) {
          const isOutOfStock = p.stock_enabled && (p.stock_quantity === null || p.stock_quantity <= 0);
          const lowStock = p.stock_enabled && p.stock_quantity !== null && p.stock_quantity > 0 && p.stock_quantity <= 3;
          
          if (isOutOfStock) {
            menu += `${i + 1}. ~${p.name}~ ❌ AGOTADO\n`;
            if (p.description) menu += `   _${p.description}_\n`;
          } else {
            menu += `${i + 1}. *${p.name}* $${Math.round(p.price).toLocaleString("es-PY")}`;
            if (lowStock) menu += ` ⚠️ (${p.stock_quantity} disponibles)`;
            if (p.image) menu += ` 📷 lapacho.ar/p/${p.id}`;
            menu += `\n`;
            if (p.description) menu += `   _${p.description}_\n`;
          }
        }

        console.log(`✅ Menu generated successfully with ${products.length} products`);
        
        const oldState2 = context.order_state || "idle";
        context.order_state = "shopping";
        context.last_menu_fetch = new Date().toISOString();
        console.log(`🔄 STATE TRANSITION: ${oldState2} → shopping (menu shown, ready to shop)`);

        await saveContext(context, supabase);
        console.log(`💾 Context saved with vendor: ${vendor.name} (${vendor.id})`);

        const now2 = new Date();
        const argTime = new Date(now2.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        
        menu += `\n_🕒 Menú actualizado: ${timeStr}_`;
        
        return menu;
      }

      case "agregar_al_carrito": {
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return `⏳ Ya tenés un pedido activo (#${orderId}). Esperá a que se complete o cancelalo antes de hacer otro. 😊`;
        }
        
        const items = args.items as CartItem[];
        console.log("🛒 ========== AGREGAR AL CARRITO ==========");
        console.log("📦 Items to add:", JSON.stringify(items, null, 2));

        if (context.order_state !== "shopping") {
          console.error(`❌ INVALID STATE: Cannot add to cart in state "${context.order_state}"`);
          return `⚠️ Para agregar productos, primero necesito mostrarte el menú.\n\n¿De qué negocio querés ver el menú?`;
        }

        if (!context.selected_vendor_id) {
          console.error(`❌ CRITICAL: No selected_vendor_id in context despite being in shopping state`);
          context.order_state = "shopping";
          await saveContext(context, supabase);
          return `⚠️ Necesito que elijas un negocio primero. ¿Cuál negocio te interesa?`;
        }

        let vendorId: string = context.selected_vendor_id;

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
        
        const vendor = data;
        console.log(`✅ Vendor validated: ${vendor.name} (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
        
        if (!vendor.is_active || vendor.payment_status !== 'active') {
          return `❌ El negocio "${vendor.name}" no está disponible en este momento.\n\nPor favor elegí otro negocio de los disponibles.`;
        }

        if (!context.selected_vendor_id) {
          return "⚠️ Primero tenés que elegir un negocio. ¿De dónde querés pedir?";
        }

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

        if (context.cart.length > 0 && 
            context.selected_vendor_id && 
            vendorId !== context.selected_vendor_id) {
          return `⚠️ Error interno: Detecté productos de otro negocio en el carrito. ` +
                 `Por favor vacía el carrito con "vaciar carrito" antes de agregar productos de otro negocio.`;
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const resolvedItems: CartItem[] = [];
        for (const item of items) {
          console.log(`🔍 Searching for product: "${item.product_name}" in vendor ${context.selected_vendor_name} (${vendorId})`);
          
          const query = uuidRegex.test(item.product_id)
            ? supabase.from("products").select("id, name, price, stock_enabled, stock_quantity").eq("id", item.product_id).maybeSingle()
            : supabase
              .from("products")
              .select("id, name, price, stock_enabled, stock_quantity")
              .ilike("name", `%${item.product_name}%`)
              .eq("vendor_id", vendorId)
              .maybeSingle();

          const { data: product } = await query;
          if (product) {
            console.log(`✅ Product found: ${product.name} - $${product.price}`);
            
            if (product.stock_enabled) {
              const currentStock = product.stock_quantity || 0;
              const existingInCart = context.cart.find(c => c.product_id === product.id);
              const alreadyInCart = existingInCart?.quantity || 0;
              const totalRequested = alreadyInCart + item.quantity;
              
              if (currentStock <= 0) {
                console.warn(`❌ STOCK: ${product.name} is OUT OF STOCK`);
                return `❌ *${product.name}* está AGOTADO.\n\nElegí otro producto del menú. 😊`;
              }
              
              if (totalRequested > currentStock) {
                const canAdd = currentStock - alreadyInCart;
                if (canAdd <= 0) {
                  return `⚠️ Ya tenés ${alreadyInCart} de *${product.name}* en el carrito (máximo disponible: ${currentStock}).\n\nNo podés agregar más unidades.`;
                }
                return `⚠️ Solo hay ${currentStock} unidades de *${product.name}* disponibles.\n\n` +
                       `Ya tenés ${alreadyInCart} en el carrito. ¿Querés agregar ${canAdd} más?`;
              }
            }
            
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
          const { data: availableProducts } = await supabase
            .from("products")
            .select("name, price")
            .eq("vendor_id", vendorId)
            .eq("is_available", true)
            .order("name");
          
          const productList = availableProducts && availableProducts.length > 0
            ? availableProducts.map((p: any, i: number) => `${i + 1}. ${p.name} - $${p.price}`).join('\n')
            : "No hay productos disponibles";
          
          return `❌ No encontré ese producto en el menú de *${context.selected_vendor_name}*.\n\n` +
                 `📋 Productos disponibles:\n${productList}\n\n` +
                 `Por favor, elegí uno de estos productos. 😊`;
        }

        for (const item of resolvedItems) {
          const existing = context.cart.find((c) => c.product_id === item.product_id);
          if (existing) existing.quantity += item.quantity;
          else context.cart.push(item);
        }

        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        return `✅ Productos agregados al carrito de *${context.selected_vendor_name}*.\n\n💰 Total actual: $${total}\n\n¿Querés agregar algo más o confirmás el pedido? 📦`;
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return "El carrito está vacío. ¿Qué te gustaría pedir?";
        }

        let carrito = `🛒 *Tu carrito de ${context.selected_vendor_name}:*\n\n`;
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        carrito += `\n💰 Total: $${total}\n\n`;
        
        if (context.delivery_type && context.payment_method) {
          context.resumen_mostrado = true;
          carrito += `✅ *Todo listo para confirmar*\n`;
          carrito += `📦 Entrega: ${context.delivery_type === 'pickup' ? 'Retiro en local' : 'Delivery'}\n`;
          carrito += `💳 Pago: ${context.payment_method}\n\n`;
          carrito += `Respondé *"sí"* para confirmar el pedido.`;
          await saveContext(context, supabase);
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
        
        resumen += `📦 *Productos:*\n`;
        context.cart.forEach((item, i) => {
          resumen += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        
        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        resumen += `\n💰 *Subtotal:* $${subtotal}\n`;
        
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
        
        const { data: vendorPaymentData } = await supabase
          .from("vendors")
          .select("payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();
        
        const paymentSettings = vendorPaymentData?.payment_settings || {};
        
        const realAvailableMethods: string[] = [];
        if (paymentSettings.efectivo === true) realAvailableMethods.push("efectivo");
        if (paymentSettings.transferencia?.activo === true) realAvailableMethods.push("transferencia");
        if (paymentSettings.mercadoPago?.activo === true) realAvailableMethods.push("mercadopago");
        
        if (context.payment_method) {
          const normalizedMethod = context.payment_method.toLowerCase();
          const isValid = realAvailableMethods.includes(normalizedMethod);
          
          if (!isValid) {
            console.log(`⚠️ payment_method "${context.payment_method}" NO es válido para este vendor`);
            context.payment_method = undefined;
            context.available_payment_methods = realAvailableMethods;
            await saveContext(context, supabase);
          }
        }
        
        if (realAvailableMethods.length > 0) {
          context.available_payment_methods = realAvailableMethods;
        }
        
        resumen += `\n💳 *Método de pago:* `;
        if (context.payment_method) {
          const paymentIcons: Record<string, string> = {
            'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳'
          };
          const icon = paymentIcons[context.payment_method.toLowerCase()] || '💰';
          resumen += `${icon} ${context.payment_method.charAt(0).toUpperCase() + context.payment_method.slice(1)}\n`;
        } else {
          resumen += `⚠️ *No seleccionado*\n`;
          
          if (context.available_payment_methods && context.available_payment_methods.length > 0) {
            resumen += `\nPor favor elegí uno de estos métodos:\n`;
            context.available_payment_methods.forEach(method => {
              const methodIcons: Record<string, string> = {
                'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳'
              };
              resumen += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${methodIcons[method] || '💰'}\n`;
            });
            return resumen;
          }
        }
        
        resumen += `\n💰💰 *TOTAL ESTIMADO:* $${subtotal}`;
        if (context.delivery_type === 'delivery') {
          resumen += ` + envío`;
        }
        resumen += `\n\n`;
        
        const missingInfo = [];
        if (!context.delivery_type) missingInfo.push("tipo de entrega");
        if (context.delivery_type === 'delivery' && !context.delivery_address) missingInfo.push("dirección");
        if (!context.payment_method) missingInfo.push("método de pago");
        
        if (missingInfo.length > 0) {
          resumen += `⚠️ *Falta completar:* ${missingInfo.join(', ')}\n`;
          return resumen;
        }
        
        resumen += `✅ *¿Confirmás el pedido?*\n`;
        resumen += `Respondé "sí" para confirmar o "no" para cancelar.`;
        
        context.resumen_mostrado = true;
        await saveContext(context, supabase);
        
        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        resumen += `\n_🕒 Resumen actualizado a las ${timeStr}_`;
        
        return resumen;
      }

      case "modificar_carrito_completo": {
        console.log(`🔄 ========== MODIFYING CART COMPLETELY ==========`);
        
        if (!context.selected_vendor_id) {
          return "⚠️ Primero necesito que elijas un negocio.";
        }

        const newCart: CartItem[] = [];
        
        for (const item of args.items) {
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
          }
        }
        
        if (newCart.length === 0) {
          return "❌ No encontré ninguno de esos productos en este negocio.";
        }
        
        context.cart = newCart;
        
        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        let response = `✅ Corregí tu pedido de *${context.selected_vendor_name}*:\n\n`;
        context.cart.forEach(item => {
          response += `• ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        response += `\n💰 Total: $${total}\n\n¿Está correcto?`;
        
        return response;
      }

      case "vaciar_carrito": {
        context.cart = [];
        context.delivery_type = undefined;
        context.conversation_history = [];
        console.log(`🧹 Cart, delivery_type and conversation history cleared`);
        return "🗑️ Carrito vaciado";
      }

      case "seleccionar_tipo_entrega": {
        const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
        console.log(`🔄 Real-time vendor config for ${context.selected_vendor_id}:`, vendorConfig);
        
        if (!vendorConfig.allows_pickup && args.tipo === "pickup") {
          return `⚠️ ${context.selected_vendor_name} no acepta retiro en local. Solo delivery.`;
        }
        
        if (!vendorConfig.allows_delivery && args.tipo === "delivery") {
          return `⚠️ ${context.selected_vendor_name} no hace delivery. Solo retiro en local.`;
        }
        
        context.delivery_type = args.tipo;
        await saveContext(context, supabase);
        
        if (args.tipo === "pickup") {
          let respuesta = `✅ Perfecto! Tu pedido será para *retiro en local*.\n\n`;
          respuesta += `📍 *Retirá en:*\n${context.selected_vendor_name}\n`;
          
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
          return `✅ Tu pedido será enviado a domicilio.\n\n¿Cuál es tu dirección de entrega?`;
        }
      }

      case "quitar_producto_carrito": {
        const searchTerm = args.product_id.toLowerCase();
        
        const index = context.cart.findIndex((item) => 
          item.product_id === args.product_id || 
          item.product_name.toLowerCase().includes(searchTerm)
        );
        
        if (index !== -1) {
          const item = context.cart[index];
          
          if (item.quantity > 1) {
            item.quantity -= 1;
            return `✅ Quité una unidad de ${item.product_name}. Ahora tenés ${item.quantity} en el carrito.`;
          } else {
            const removed = context.cart.splice(index, 1)[0];
            return `✅ Quité ${removed.product_name} del carrito.`;
          }
        }
        
        return "❌ No encontré ese producto en el carrito. ¿Querés que te muestre lo que tenés en el carrito?";
      }

      case "crear_pedido": {
        if (args.metodo_pago && !context.payment_method) {
          const methodMap: Record<string, string> = {
            'efectivo': 'efectivo', 'cash': 'efectivo',
            'transferencia': 'transferencia', 'transfer': 'transferencia', 'transferencia bancaria': 'transferencia',
            'mercadopago': 'mercadopago', 'mercado pago': 'mercadopago', 'mp': 'mercadopago'
          };
          const normalizedInput = args.metodo_pago.toLowerCase().trim();
          const mappedMethod = methodMap[normalizedInput];
          
          if (mappedMethod && (!context.available_payment_methods?.length || 
              context.available_payment_methods.includes(mappedMethod))) {
            context.payment_method = mappedMethod;
            console.log(`✅ Pre-set payment_method from args: ${mappedMethod}`);
            await saveContext(context, supabase);
          }
        }
        
        if (!context.resumen_mostrado) {
          console.log("⚠️ resumen_mostrado=false, auto-calling mostrar_resumen_pedido first");
          const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
          return resumenResult;
        }
        
        // ⭐ VALIDACIÓN CRÍTICA: Verificar que el método de pago es válido
        if (args.metodo_pago && context.available_payment_methods?.length > 0) {
          const normalizedMethod = args.metodo_pago.toLowerCase().trim();
          const methodMap: Record<string, string> = {
            'efectivo': 'efectivo', 'cash': 'efectivo',
            'transferencia': 'transferencia', 'transferencia bancaria': 'transferencia', 'transfer': 'transferencia',
            'mercadopago': 'mercadopago', 'mercado pago': 'mercadopago', 'mp': 'mercadopago'
          };
          
          const mappedMethod = methodMap[normalizedMethod];
          
          if (!mappedMethod || !context.available_payment_methods.includes(mappedMethod)) {
            const methodIcons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
            
            return `⚠️ El método "${args.metodo_pago}" no está disponible en ${context.selected_vendor_name}.\n\n` +
                   `Métodos aceptados:\n` +
                   (context.available_payment_methods || []).map(m => 
                     `- ${m.charAt(0).toUpperCase() + m.slice(1)} ${methodIcons[m] || '💰'}`
                   ).join('\n') + 
                   `\n\n¿Con cuál querés continuar?`;
          }
        }
        
        // ⭐ AUTO-FETCH payment methods si tiene dirección pero no ha visto los métodos
        if (args.direccion && !context.payment_methods_fetched) {
          console.log(`⚠️ User has address but hasn't seen payment methods yet. Auto-fetching...`);
          context.delivery_address = args.direccion;
          await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
          await saveContext(context, supabase);
        }
        
        const normalized = args.metodo_pago?.toLowerCase().trim() || "";
        const hasValidPaymentMethod = args.metodo_pago && (
          normalized === "efectivo" || normalized === "transferencia" ||
          normalized === "transferencia bancaria" || normalized === "mercadopago" ||
          normalized === "mercado pago"
        );
        
        if (context.order_state !== "checkout" && !hasValidPaymentMethod) {
          if (context.payment_methods_fetched && context.available_payment_methods) {
            const methodsList = context.available_payment_methods.map(m => `- ${m}`).join('\n');
            return `⚠️ Por favor elegí uno de los métodos de pago disponibles:\n\n${methodsList}`;
          }
          return "⚠️ Primero necesito que confirmes tu método de pago.";
        }
        
        if (context.order_state === "shopping" && hasValidPaymentMethod) {
          context.order_state = "checkout";
        }

        if (context.cart.length === 0) {
          return "No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?";
        }

        // 🛡️ VALIDACIÓN FINAL DE STOCK
        const stockIssues: string[] = [];
        for (const cartItem of context.cart) {
          const { data: stockProduct } = await supabase
            .from("products")
            .select("name, stock_enabled, stock_quantity")
            .eq("id", cartItem.product_id)
            .single();
          
          if (stockProduct && stockProduct.stock_enabled) {
            const available = stockProduct.stock_quantity || 0;
            if (cartItem.quantity > available) {
              if (available <= 0) {
                stockIssues.push(`❌ *${stockProduct.name}* - AGOTADO`);
              } else {
                stockIssues.push(`⚠️ *${stockProduct.name}* - Pediste ${cartItem.quantity}, solo hay ${available}`);
              }
            }
          }
        }

        if (stockIssues.length > 0) {
          return `🚫 *No se puede crear el pedido*\n\n` +
                 `Algunos productos ya no tienen stock suficiente:\n\n` +
                 stockIssues.join('\n') +
                 `\n\nPor favor ajustá tu carrito con "modificar carrito" o eliminá los productos sin stock.`;
        }

        if (!context.selected_vendor_id) {
          return "Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.";
        }

        // ✅ SIEMPRE consultar en tiempo real para tipo de entrega
        if (!context.delivery_type) {
          const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
          
          if (vendorConfig.allows_pickup && vendorConfig.allows_delivery) {
            return `¿Querés que te enviemos el pedido a domicilio o lo retirás en el local?\n\nRespondé "delivery" o "retiro"`;
          } else if (vendorConfig.allows_pickup && !vendorConfig.allows_delivery) {
            context.delivery_type = 'pickup';
          } else {
            context.delivery_type = 'delivery';
          }
        }

        let deliveryCost = 0;
        
        if (context.delivery_type === 'pickup') {
          const { data: vendorAddr } = await supabase
            .from("vendors")
            .select("address")
            .eq("id", context.selected_vendor_id)
            .single();
          
          context.delivery_address = `RETIRO EN LOCAL: ${vendorAddr?.address || 'Dirección no disponible'}`;
          deliveryCost = 0;
        } else {
          const { data: vendorDel } = await supabase
            .from("vendors")
            .select("delivery_fixed_price")
            .eq("id", context.selected_vendor_id)
            .single();
          
          deliveryCost = Math.round(vendorDel?.delivery_fixed_price || 0);

          if (!args.direccion && !context.delivery_address) {
            return `📍 Para confirmar tu pedido, necesito tu dirección de entrega.\n\n✍️ Escribí tu dirección completa (calle y número).\n\nEl negocio confirmará si hace delivery a tu zona. 🚗`;
          }

          if (context.delivery_address) {
            args.direccion = context.delivery_address;
          } else {
            context.delivery_address = args.direccion;
          }
        }

        // 🚫 Verificar pedidos duplicados
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id, status, vendor_id, created_at")
          .eq("customer_phone", context.phone)
          .in("status", ["pending", "confirmed", "preparing"])
          .gte("created_at", new Date(Date.now() - 60000).toISOString())
          .order("created_at", { ascending: false });

        if (activeOrders && activeOrders.length > 0) {
          const recentOrder = activeOrders[0];
          if (recentOrder.vendor_id === context.selected_vendor_id) {
            context.pending_order_id = recentOrder.id;
            context.last_order_id = recentOrder.id;
            return `✅ Ya tenés un pedido activo (#${recentOrder.id.substring(0, 8)}).\n\n📊 Podés consultar su estado diciendo "estado del pedido".\n\nSi querés hacer otro pedido, esperá a que este se complete. 😊`;
          }
        }

        if (context.delivery_type !== 'pickup' && (!args.direccion || args.direccion.trim() === "")) {
          return "Por favor indicá tu dirección de entrega.";
        }

        if (!args.metodo_pago) {
          return "Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).";
        }

        // ⚠️ VALIDAR método de pago habilitado
        const { data: vendorForPayment, error: vendorPaymentError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorPaymentError || !vendorForPayment) {
          return "Hubo un problema al validar el método de pago. Por favor intentá de nuevo.";
        }

        const pSettings = vendorForPayment.payment_settings || {};
        const metodoSolicitado = args.metodo_pago.toLowerCase();

        let metodoValido = false;
        if (metodoSolicitado === "efectivo" && pSettings.efectivo === true) metodoValido = true;
        else if (metodoSolicitado === "transferencia" && pSettings.transferencia?.activo === true) metodoValido = true;
        else if (metodoSolicitado === "mercadopago" && pSettings.mercadoPago?.activo === true) metodoValido = true;

        if (!metodoValido) {
          return `⚠️ El método de pago "${metodoSolicitado}" no está disponible en ${vendorForPayment.name}.\n\nPor favor usá ver_metodos_pago para ver las opciones reales disponibles.`;
        }

        context.delivery_address = args.direccion;
        context.payment_method = args.metodo_pago;

        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + deliveryCost;

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
            address_is_manual: true,
            delivery_type: context.delivery_type || 'delivery',
            coordinates: context.user_latitude ? { lat: context.user_latitude, lng: context.user_longitude } : null,
          })
          .select()
          .single();

        if (error || !order) {
          console.error("Error creating order:", error);
          return "Hubo un error al crear tu pedido. Por favor intentá de nuevo.";
        }

        console.log("✅ Order created:", order.id);

        // Create payment record
        await supabase.from("order_payments").insert({
          order_id: order.id,
          payment_method_name: context.payment_method,
          amount: total,
          status: "pending",
        });

        // Notify vendor
        const orderCreatedAt = new Date(order.created_at);
        const nowTs = new Date();
        const secondsSinceCreation = (nowTs.getTime() - orderCreatedAt.getTime()) / 1000;
        
        if (secondsSinceCreation < 30) {
          try {
            await supabase.functions.invoke("notify-vendor", {
              body: { orderId: order.id, eventType: "new_order" },
            });
          } catch (notifyErr) {
            console.error("💥 Exception notifying vendor:", notifyErr);
          }
        }

        // Clean temp addresses
        try {
          await supabase
            .from("saved_addresses")
            .delete()
            .eq("phone", context.phone)
            .eq("is_temporary", true);
        } catch (_e) {}

        let confirmacion = `✅ ¡Pedido creado exitosamente!\n\n`;
        confirmacion += `📦 Pedido #${order.id.substring(0, 8)}\n`;
        confirmacion += `🏪 Negocio: ${context.selected_vendor_name}\n\n`;

        if (context.delivery_type === 'pickup') {
          confirmacion += `🛒 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;
          confirmacion += `📍 *Retirá en:*\n${context.delivery_address}\n\n`;
          if (context.pickup_instructions) {
            confirmacion += `📝 ${context.pickup_instructions}\n\n`;
          }
          confirmacion += `💳 Pago: ${context.payment_method}\n`;
        } else {
          confirmacion += `🛒 Subtotal: $ ${Math.round(subtotal).toLocaleString("es-PY")}\n`;
          confirmacion += `🚚 Delivery: $ ${Math.round(deliveryCost).toLocaleString("es-PY")}\n`;
          confirmacion += `💰 Total: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;
          confirmacion += `📍 Dirección: ${context.delivery_address}\n`;
          confirmacion += `💳 Pago: ${context.payment_method}\n`;
          if (deliveryCost > 0) {
            confirmacion += `\n📌 *Nota:* El negocio confirmará si hace delivery a tu zona.\n`;
          }
        }
        
        confirmacion += `\n`;

        const newState = getPendingStateForPayment(context.payment_method);
        context.order_state = newState;

        if (context.payment_method.toLowerCase().includes("transferencia")) {
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
          let paymentLinkGenerated = false;
          let paymentLinkUrl = "";
          let paymentErrorMsg = "";
          
          try {
            const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
              body: { orderId: order.id },
            });

            if (paymentError) {
              paymentErrorMsg = "⚠️ Hubo un problema al generar el link de pago. El negocio te contactará.";
            } else if (paymentData?.success && paymentData?.payment_link) {
              paymentLinkGenerated = true;
              paymentLinkUrl = paymentData.payment_link;
            } else if (paymentData?.available_methods) {
              paymentErrorMsg = "⚠️ MercadoPago no está disponible en este momento.\n\n";
              paymentErrorMsg += "Métodos de pago alternativos:\n\n";
              for (const method of paymentData.available_methods) {
                if (method.method === 'transferencia') {
                  paymentErrorMsg += `📱 *Transferencia bancaria:*\n• Alias: ${method.details.alias}\n• CBU/CVU: ${method.details.cbu}\n• Titular: ${method.details.titular}\n• Monto: $${method.details.amount}\n\n`;
                } else if (method.method === 'efectivo') {
                  paymentErrorMsg += `💵 *Efectivo:* ${method.details.message}\n\n`;
                }
              }
            } else {
              paymentErrorMsg = "⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.";
            }
          } catch (_e) {
            paymentErrorMsg = "⚠️ Error al procesar el pago. El negocio te contactará.";
          }
          
          if (paymentLinkGenerated) {
            confirmacion += `💳 *¡Link de pago listo!*\n\n🔗 ${paymentLinkUrl}\n\n👆 Tocá el link para pagar de forma segura con MercadoPago.\n\nUna vez que completes el pago, recibirás la confirmación automáticamente. 😊`;
          } else {
            confirmacion += paymentErrorMsg;
          }
        }

        context.cart = [];
        context.conversation_history = [];
        context.last_order_id = order.id;
        context.pending_order_id = order.id;
        context.resumen_mostrado = false;
        await saveContext(context, supabase);

        return confirmacion;
      }

      case "ver_estado_pedido": {
        let orderId = args.order_id;
        
        if (!orderId && context.pending_order_id) orderId = context.pending_order_id;
        else if (!orderId && context.last_order_id) orderId = context.last_order_id;
        
        if (!orderId) {
          return "No tengo ningún pedido tuyo registrado recientemente. ¿Querés hacer un nuevo pedido?";
        }
        
        const { data: order, error } = await supabase
          .from("orders")
          .select("*, vendors(name)")
          .eq("id", orderId)
          .single();

        if (error || !order) {
          return "No encontré ese pedido. ¿Querés que te ayude con algo más?";
        }

        const statusEmojis: any = {
          pending: "⏳ Pendiente", confirmed: "✅ Confirmado",
          preparing: "👨‍🍳 En preparación", ready: "🎉 Listo para entregar",
          delivered: "✅ Entregado", cancelled: "❌ Cancelado",
        };

        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

        let estado = `📊 *Estado de tu pedido*\n\n`;
        estado += `🆔 Pedido #${order.id.substring(0, 8)}\n`;
        estado += `🏪 Negocio: ${order.vendors.name}\n`;
        estado += `✨ Estado: *${statusEmojis[order.status] || order.status}*\n`;
        estado += `💰 Total: $${Math.round(order.total).toLocaleString("es-AR")}\n\n`;
        estado += `_🕒 Actualizado hoy ${timeStr}_`;

        return estado;
      }

      case "ver_ofertas": {
        const nowIso: string = new Date().toISOString();

        let targetVendorId = context.selected_vendor_id;

        if (args.vendor_id && !context.selected_vendor_id) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(args.vendor_id)) {
            targetVendorId = args.vendor_id;
          } else {
            const { data: vendorByName } = await supabase
              .from("vendors").select("id").ilike("name", args.vendor_id).maybeSingle();
            if (vendorByName) targetVendorId = vendorByName.id;
          }
        }

        let query = supabase
          .from("vendor_offers")
          .select("*, vendors(id, name, category, latitude, longitude, delivery_radius_km, is_active)")
          .eq("is_active", true)
          .lte("valid_from", nowIso)
          .or(`valid_until.gte.${nowIso},valid_until.is.null`);

        if (targetVendorId) query = query.eq("vendor_id", targetVendorId);

        const { data: offers, error } = await query;

        if (error || !offers || offers.length === 0) {
          return targetVendorId
            ? "Este negocio no tiene ofertas activas en este momento."
            : "No hay ofertas disponibles en este momento. 😔";
        }

        let resultado = `🎁 ${offers.length === 1 ? "Oferta disponible" : `${offers.length} ofertas disponibles`}:\n\n`;

        offers.forEach((offer: any, i: number) => {
          resultado += `${i + 1}. ${offer.title}\n`;
          resultado += `   🏪 ${offer.vendors.name}\n`;
          resultado += `   📝 ${offer.description}\n`;
          if (offer.discount_percentage) resultado += `   💰 ${offer.discount_percentage}% OFF\n`;
          if (offer.original_price && offer.offer_price) resultado += `   💵 Antes: $${offer.original_price} → Ahora: $${offer.offer_price}\n`;
          if (offer.valid_until) {
            const validUntil = new Date(offer.valid_until);
            resultado += `   ⏰ Válido hasta: ${validUntil.toLocaleDateString("es-AR")}\n`;
          }
          resultado += `   ID Negocio: ${offer.vendor_id}\n\n`;
        });

        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        resultado += `_🕒 Ofertas actualizadas hoy ${timeStr}_`;
        
        return resultado;
      }

      case "cancelar_pedido": {
        if (!args.motivo || args.motivo.trim().length < 5) {
          context.pending_cancellation = {
            step: "awaiting_reason",
            order_id: args.order_id || context.pending_order_id || context.last_order_id,
          };
          await saveContext(context, supabase);
          return "¿Por qué querés cancelar el pedido? Escribí el motivo:";
        }

        let orderId = args.order_id;
        if (!orderId && context.last_order_id) orderId = context.last_order_id;
        
        if (!orderId) {
          const { data: recentOrders } = await supabase
            .from("orders")
            .select("id, status, created_at")
            .eq("customer_phone", context.phone)
            .in("status", ["pending", "preparing", "confirmed"])
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (!recentOrders || recentOrders.length === 0) {
            return "No encontré ningún pedido activo para cancelar.";
          }
          orderId = recentOrders[0].id;
        }
        
        if (orderId && orderId.length === 8) {
          const { data: matchingOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("customer_phone", context.phone)
            .ilike("id", `${orderId}%`)
            .limit(1);
          
          if (!matchingOrders || matchingOrders.length === 0) {
            return `No encontré un pedido con ID #${orderId}`;
          }
          orderId = matchingOrders[0].id;
        }

        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (fetchError || !order) return "No encontré ese pedido. Por favor verificá el número de pedido.";
        if (order.customer_phone !== context.phone) return "Este pedido no te pertenece.";
        if (order.status === "cancelled") return "Este pedido ya está cancelado.";
        if (["delivered", "ready"].includes(order.status)) return `No se puede cancelar un pedido que ya está "${order.status}".`;

        await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
        await supabase.from("order_status_history").insert({
          order_id: orderId, status: "cancelled", changed_by: "customer", reason: args.motivo,
        });

        try {
          await supabase.functions.invoke("notify-vendor", {
            body: { orderId: orderId, eventType: "order_cancelled" },
          });
        } catch (_e) {}

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

        return `✅ Pedido #${orderId.substring(0, 8)} cancelado.\n📝 Motivo: ${args.motivo}\n\nEl vendedor ha sido notificado.\n\n¿Querés hacer un nuevo pedido? 😊`;
      }

      case "ver_metodos_pago": {
        if (!context.selected_vendor_id) {
          return "Primero tenés que elegir un negocio. ¿Querés ver los negocios disponibles?";
        }

        context.payment_method = undefined;

        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorError || !vendor) return "Hubo un problema al obtener los métodos de pago del negocio.";

        const paymentSettings = vendor.payment_settings || {};
        const metodosDisponibles: string[] = [];
        const availableKeys: string[] = [];
        let datosTransferencia = "";

        if (paymentSettings.efectivo === true) {
          metodosDisponibles.push("- Efectivo 💵");
          availableKeys.push("efectivo");
        }

        if (paymentSettings.transferencia?.activo === true) {
          metodosDisponibles.push("- Transferencia bancaria 🏦");
          availableKeys.push("transferencia");
          const { alias, cbu, titular } = paymentSettings.transferencia;
          if (alias && cbu && titular) {
            datosTransferencia = `\n\n📋 *Datos para transferencia:*\n• Alias: ${alias}\n• CBU/CVU: ${cbu}\n• Titular: ${titular}`;
          }
        }

        if (paymentSettings.mercadoPago?.activo === true) {
          metodosDisponibles.push("- MercadoPago 💳");
          availableKeys.push("mercadopago");
        }

        if (metodosDisponibles.length === 0) {
          return `⚠️ ${vendor.name} todavía no configuró métodos de pago. Por favor contactá directamente con el negocio.`;
        }

        context.payment_methods_fetched = true;
        context.available_payment_methods = availableKeys;

        const textoMetodos = metodosDisponibles.length === 1 
          ? "Tenés disponible el siguiente método de pago:"
          : "Estos son los métodos de pago disponibles:";

        const metodosNumerados = metodosDisponibles.map((m, i) => `${i + 1}. *${m.replace('- ', '')}*`).join('\n');

        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        
        return `${textoMetodos}\n\n${metodosNumerados}${datosTransferencia}\n\n_🕒 Lista de pagos actualizada: ${timeStr}_\n\nElegí uno (podés escribir el número o el nombre). 😊`;
      }

      case "seleccionar_metodo_pago": {
        const metodo = args.metodo?.toLowerCase().trim();
        let normalizedMethod: string | null = null;
        
        if (/^[123]$/.test(metodo) && context.available_payment_methods && context.available_payment_methods.length > 0) {
          const index = parseInt(metodo) - 1;
          if (index >= 0 && index < context.available_payment_methods.length) {
            normalizedMethod = context.available_payment_methods[index];
          }
        }
        
        if (!normalizedMethod) {
          const methodMap: Record<string, string> = {
            'efectivo': 'efectivo', 'cash': 'efectivo', 'plata': 'efectivo', 'uno': 'efectivo',
            'transferencia': 'transferencia', 'transfer': 'transferencia', 'banco': 'transferencia', 'dos': 'transferencia',
            'mercadopago': 'mercadopago', 'mercado pago': 'mercadopago', 'mp': 'mercadopago', 'tres': 'mercadopago'
          };
          normalizedMethod = methodMap[metodo] || metodo;
        }
        
        if (!context.available_payment_methods || context.available_payment_methods.length === 0) {
          return `⚠️ Primero necesito ver qué métodos de pago acepta el negocio. Dame un momento...`;
        }
        
        if (!context.available_payment_methods.includes(normalizedMethod)) {
          const available = context.available_payment_methods.map((m, i) => `${i + 1}. ${m}`).join('\n');
          return `❌ "${metodo}" no está disponible para este negocio.\n\nMétodos disponibles:\n${available}`;
        }
        
        context.payment_method = normalizedMethod;
        await saveContext(context, supabase);
        
        const icons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
        const labels: Record<string, string> = { 'efectivo': 'Efectivo', 'transferencia': 'Transferencia', 'mercadopago': 'MercadoPago' };
        
        return `✅ Método de pago: ${icons[normalizedMethod] || '💰'} ${labels[normalizedMethod] || normalizedMethod}`;
      }

      case "hablar_con_vendedor": {
        let vendorId = context.selected_vendor_id;

        if (!vendorId) {
          return "Primero necesito que selecciones un negocio. Podés buscar productos o locales para elegir con quién querés hablar.";
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(vendorId)) {
          const { data: foundVendor } = await supabase
            .from("vendors").select("id, name").ilike("name", `%${vendorId}%`).maybeSingle();

          if (foundVendor) {
            vendorId = foundVendor.id;
            context.selected_vendor_id = foundVendor.id;
          } else {
            return "No pude encontrar el negocio seleccionado. Por favor buscá locales o productos de nuevo.";
          }
        }

        const { data: vendor, error: vendorError } = await supabase
          .from("vendors").select("phone, whatsapp_number, name").eq("id", vendorId).single();

        if (vendorError || !vendor) return "Hubo un problema al conectar con el negocio. Por favor intentá de nuevo.";

        const vendorPhone = vendor.whatsapp_number || vendor.phone;

        const { data: existingChat } = await supabase
          .from("vendor_chats").select("id")
          .eq("vendor_id", vendorId).eq("customer_phone", context.phone).eq("is_active", true)
          .maybeSingle();

        let chatId = existingChat?.id;

        if (!chatId) {
          const { data: newChat, error: chatError } = await supabase
            .from("vendor_chats")
            .insert({ vendor_id: vendorId, customer_phone: context.phone, is_active: true })
            .select("id").single();

          if (!chatError && newChat) {
            chatId = newChat.id;
            await supabase.from("chat_messages").insert({
              chat_id: chatId, sender_type: "bot", message: `Un cliente solicitó hablar con el vendedor`,
            });

            try {
              await supabase.functions.invoke("notify-vendor", {
                body: { orderId: args.order_id || "no-order", eventType: "customer_message", vendorId },
              });
            } catch (_e) {}
          }
        }

        await supabase.from("user_sessions").upsert(
          { phone: context.phone, assigned_vendor_phone: vendorPhone, in_vendor_chat: true, updated_at: new Date().toISOString() },
          { onConflict: "phone" },
        );

        return `👤 *Conectando con ${vendor.name}*\n\nUn representante del negocio te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\nPara volver al bot automático, el vendedor puede reactivarlo desde su panel.`;
      }

      case "registrar_calificacion": {
        if (!args.delivery_rating && !args.service_rating && !args.product_rating && !args.comment) {
          return "Por favor proporciona al menos una calificación (delivery, atención o producto) o un comentario.";
        }

        const { data: recentOrder } = await supabase
          .from("orders").select("id, vendor_id")
          .eq("customer_phone", context.phone)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (!recentOrder) return "No encontré ningún pedido reciente para calificar.";

        const ratings = [args.delivery_rating, args.service_rating, args.product_rating].filter(r => r !== null && r !== undefined);
        const averageRating = ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : null;

        const { error } = await supabase.from("vendor_reviews").insert({
          vendor_id: recentOrder.vendor_id, order_id: recentOrder.id,
          customer_phone: context.phone, customer_name: args.customer_name || context.phone,
          rating: averageRating, delivery_rating: args.delivery_rating,
          service_rating: args.service_rating, product_rating: args.product_rating, comment: args.comment,
        });

        if (error) return "Hubo un error al guardar tu calificación. Por favor intenta de nuevo.";

        let respuesta = "⭐ *¡Gracias por tu calificación!*\n\n📊 *Tu calificación:*\n";
        if (args.delivery_rating) respuesta += `🚚 Tiempo de entrega: ${args.delivery_rating}/5\n`;
        if (args.service_rating) respuesta += `👥 Atención: ${args.service_rating}/5\n`;
        if (args.product_rating) respuesta += `📦 Producto: ${args.product_rating}/5\n`;
        if (args.comment) respuesta += `\n💬 Comentario: "${args.comment}"\n`;
        respuesta += "\nTu opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros! 😊";

        return respuesta;
      }

      case "calificar_plataforma": {
        if (!args.rating || args.rating < 1 || args.rating > 5) {
          return "Por favor proporciona una calificación válida entre 1 y 5 estrellas.";
        }

        const { error } = await supabase.from("platform_reviews").insert({
          user_type: "customer", reviewer_phone: context.phone,
          reviewer_name: args.customer_name || context.phone,
          rating: args.rating, comment: args.comment || null,
        });

        if (error) return "Hubo un error al guardar tu reseña. Por favor intenta de nuevo.";

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
            priority: prioridad === "baja" ? "low" : prioridad === "alta" ? "high" : prioridad === "urgente" ? "urgent" : "normal",
            status: "open",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          return "Hubo un error al crear el ticket. Intenta de nuevo o contacta directamente con soporte.";
        }

        await supabase.from("support_messages").insert({
          ticket_id: ticket.id, sender_type: "customer", message: args.descripcion,
        });

        return `✅ *Ticket de soporte creado*\n\n📋 ID: #${ticket.id.substring(0, 8)}\n🏷️ Asunto: ${args.asunto}\n⚡ Prioridad: ${prioridad}\n\nNuestro equipo de soporte te contactará pronto. Los mensajes que envíes ahora irán directamente al equipo de soporte.\n\n💡 *Importante:* El bot se desactivará hasta que el equipo de soporte cierre tu ticket.`;
      }

      case "mostrar_menu_ayuda": {
        return t('help.full', context.language || 'es');
      }

      case "confirmar_direccion_entrega": {
        console.log("📍 ========== CONFIRMAR DIRECCION ENTREGA ==========");
        
        const direccion = args.direccion?.trim();
        
        if (!direccion || direccion.length < 3) {
          return "⚠️ Por favor proporcioná una dirección más completa (calle y número).";
        }
        
        context.delivery_address = direccion;
        
        if (!context.delivery_type) {
          context.delivery_type = 'delivery';
        }
        
        await saveContext(context, supabase);
        
        let response = `📍 Perfecto, tu pedido será enviado a: **${direccion}**\n\n`;
        
        if (context.cart.length > 0 && context.selected_vendor_id) {
          if (!context.payment_method) {
            if (context.available_payment_methods && context.available_payment_methods.length > 0) {
              response += `¿Con qué método de pago querés confirmar?\n`;
              context.available_payment_methods.forEach(method => {
                const icons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
                response += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${icons[method] || '💰'}\n`;
              });
            } else {
              response += `¿Querés confirmar el pedido? 📦`;
            }
          } else {
            response += `¿Confirmás el pedido con pago en ${context.payment_method}? 📦`;
          }
        }
        
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
