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

  const lang = (context.language || 'es') as Language;

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
          return t('search.no_results', lang, { query: args.consulta });
        }

        const vendorMap: Array<{ index: number; name: string; vendor_id: string }> = [];
        let resultado = t('search.results_header', lang, { query: args.consulta }) + `\n\n`;
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

        resultado += t('search.select_prompt', lang);
        return resultado;
      }

      case "ver_locales_abiertos": {
        // 🚫 Validar que no haya pedido activo
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return t('order.active_exists', lang, { id: orderId });
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
          return t('error.vendor_fetch', lang);
        }

        if (!vendorsInRange || vendorsInRange.length === 0) {
          return t('vendors.no_available', lang);
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

        let resultado = t('vendors.header', lang) + "\n\n";

        const vendorMap: Array<{ index: number; name: string; vendor_id: string }> = [];
        let currentIndex = 1;

        if (openVendors.length > 0) {
          resultado += `${t('vendors.open_now', lang)} (${openVendors.length}):\n\n`;
          openVendors.forEach((v: any) => {
            resultado += `${currentIndex}. *${v.name}*\n`;
            resultado += `📍 ${v.address || t('vendors.address_unavailable', lang)}\n`;
            
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
              if (slots.length > 0) resultado += `⏰ ${t('vendors.schedule', lang)}: ${slots.join(", ")}\n`;
            }

            if (v.average_rating && v.total_reviews)
              resultado += `⭐ ${t('vendors.rating', lang)}: ${v.average_rating.toFixed(1)} (${v.total_reviews} ${t('vendors.reviews', lang)})\n`;

            resultado += `\n`;
          });
        }

        if (closedVendors.length > 0) {
          resultado += `\n${t('vendors.closed', lang)} (${closedVendors.length}) - ${t('vendors.closed_hint', lang)}\n`;
        }

        context.available_vendors_map = vendorMap;
        context.last_vendors_fetch = new Date().toISOString();
        const oldState = context.order_state || "idle";
        context.order_state = "browsing";
        console.log(`🔄 STATE: ${oldState} → browsing (ver_locales_abiertos)`);
        await saveContext(context, supabase);

        const timeStr = argentinaTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        resultado += `\n\n_${t('vendors.updated_at', lang, { time: timeStr })}_`;
        resultado += "\n" + t('vendors.select_menu', lang);

        return resultado;
      }

      case "ver_menu_negocio": {
        console.log(`🔍 ========== VER MENU NEGOCIO ==========`);
        console.log(`📝 Args vendor_id: "${args.vendor_id}"`);

        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return t('order.active_exists', lang, { id: orderId });
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
          return t('menu.not_found', lang);
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
          const itemsList = context.cart.map((item, i) => 
            `${i + 1}. ${item.product_name} x${item.quantity}`
          ).join('\n');
          
          return t('vendor_change.warning', lang, {
            count: String(context.cart.length),
            current_vendor: context.selected_vendor_name || '',
            items: itemsList,
            total: String(currentTotal),
            new_vendor: vendor.name,
          });
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
          return t('menu.fetch_error', lang, { vendor: vendor.name });
        }

        console.log(`📦 Products found: ${products?.length || 0}`);
        
        if (!products || products.length === 0) {
          console.log(`⚠️ No products available for vendor: ${vendor.name} (${vendor.id})`);
          return t('menu.no_products', lang, { vendor: vendor.name });
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
          menu += `📍 ${vendorDetails?.address || ''} | ${t('menu.delivery_and_pickup', lang)}\n\n`;
        } else if (context.vendor_allows_pickup && !context.vendor_allows_delivery) {
          menu += `📍 ${vendorDetails?.address || ''} | ${t('menu.pickup_only', lang)}\n\n`;
        } else {
          menu += `${t('menu.delivery_only', lang)}\n\n`;
        }
        
        for (const [i, p] of products.entries()) {
          const isOutOfStock = p.stock_enabled && (p.stock_quantity === null || p.stock_quantity <= 0);
          const lowStock = p.stock_enabled && p.stock_quantity !== null && p.stock_quantity > 0 && p.stock_quantity <= 3;
          
          if (isOutOfStock) {
            menu += `${i + 1}. ~${p.name}~ ❌ ${t('menu.out_of_stock', lang)}\n`;
            if (p.description) menu += `   _${p.description}_\n`;
          } else {
            menu += `${i + 1}. *${p.name}* $${Math.round(p.price).toLocaleString("es-PY")}`;
            if (lowStock) menu += ` ⚠️ (${p.stock_quantity} ${t('menu.low_stock', lang)})`;
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
        
        menu += `\n_${t('menu.updated_at', lang, { time: timeStr })}_`;
        
        return menu;
      }

      case "agregar_al_carrito": {
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return t('order.active_exists', lang, { id: orderId });
        }
        
        const items = args.items as CartItem[];
        console.log("🛒 ========== AGREGAR AL CARRITO ==========");
        console.log("📦 Items to add:", JSON.stringify(items, null, 2));

        if (context.order_state !== "shopping") {
          console.error(`❌ INVALID STATE: Cannot add to cart in state "${context.order_state}"`);
          return t('shopping.need_menu', lang);
        }

        if (!context.selected_vendor_id) {
          console.error(`❌ CRITICAL: No selected_vendor_id in context despite being in shopping state`);
          context.order_state = "shopping";
          await saveContext(context, supabase);
          return t('shopping.need_vendor', lang);
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
          return t('shopping.vendor_error', lang);
        }
        
        if (!data) {
          console.error(`❌ Vendor ${vendorId} from context not found in database`);
          return t('shopping.vendor_unavailable', lang);
        }
        
        const vendor = data;
        console.log(`✅ Vendor validated: ${vendor.name} (Active: ${vendor.is_active}, Payment: ${vendor.payment_status})`);
        
        if (!vendor.is_active || vendor.payment_status !== 'active') {
          return t('shopping.vendor_inactive', lang, { vendor: vendor.name });
        }

        if (!context.selected_vendor_id) {
          return t('shopping.need_vendor_first', lang);
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
              return t('shopping.wrong_vendor', lang, { vendor: context.selected_vendor_name || '' });
            }
          }
        }

        if (context.cart.length > 0 && 
            context.selected_vendor_id && 
            vendorId !== context.selected_vendor_id) {
          return t('shopping.cart_vendor_mismatch', lang);
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
                return t('stock.out_of_stock', lang, { product: product.name });
              }
              
              if (totalRequested > currentStock) {
                const canAdd = currentStock - alreadyInCart;
                if (canAdd <= 0) {
                  return t('stock.max_reached', lang, { count: String(alreadyInCart), product: product.name, max: String(currentStock) });
                }
                return t('stock.limited', lang, { available: String(currentStock), product: product.name, count: String(alreadyInCart), can_add: String(canAdd) });
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
            : t('shopping.no_products_available', lang);
          
          return t('shopping.product_not_found', lang, { vendor: context.selected_vendor_name || '', products: productList });
        }

        for (const item of resolvedItems) {
          const existing = context.cart.find((c) => c.product_id === item.product_id);
          if (existing) existing.quantity += item.quantity;
          else context.cart.push(item);
        }

        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        return t('cart.added', lang, { vendor: context.selected_vendor_name || '', total: String(total) });
      }

      case "ver_carrito": {
        if (context.cart.length === 0) {
          return t('cart.empty', lang);
        }

        let carrito = t('cart.header', lang, { vendor: context.selected_vendor_name || '' }) + `\n\n`;
        context.cart.forEach((item, i) => {
          carrito += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });

        const total = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        carrito += `\n💰 ${t('cart.total', lang)}: $${total}\n\n`;
        
        if (context.delivery_type && context.payment_method) {
          context.resumen_mostrado = true;
          carrito += t('cart.ready_to_confirm', lang) + `\n`;
          carrito += `📦 ${t('label.delivery_label', lang)}: ${context.delivery_type === 'pickup' ? t('delivery.pickup_label', lang) : 'Delivery'}\n`;
          carrito += `💳 ${t('label.payment', lang)}: ${context.payment_method}\n\n`;
          carrito += t('cart.confirm_yes', lang);
          await saveContext(context, supabase);
        } else {
          carrito += t('cart.confirm_prompt', lang);
        }

        return carrito;
      }

      case "mostrar_resumen_pedido": {
        console.log("📋 ========== MOSTRAR RESUMEN PEDIDO ==========");
        
        if (context.cart.length === 0) {
          return t('cart.empty_warning', lang);
        }

        if (!context.selected_vendor_id || !context.selected_vendor_name) {
          return t('summary.no_vendor', lang);
        }

        let resumen = t('summary.header', lang) + `\n\n`;
        resumen += t('summary.store', lang, { vendor: context.selected_vendor_name }) + `\n\n`;
        
        resumen += t('summary.products', lang) + `\n`;
        context.cart.forEach((item, i) => {
          resumen += `${i + 1}. ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        
        const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        resumen += `\n` + t('summary.subtotal', lang, { amount: String(subtotal) }) + `\n`;
        
        if (context.delivery_type === 'pickup') {
          resumen += `\n` + t('summary.pickup', lang) + `\n`;
          if (context.pickup_instructions) {
            resumen += `   ℹ️ ${context.pickup_instructions}\n`;
          }
        } else if (context.delivery_type === 'delivery') {
          resumen += `\n` + t('summary.delivery', lang) + `\n`;
          if (context.delivery_address) {
            resumen += t('summary.address', lang, { address: context.delivery_address }) + `\n`;
          } else {
            resumen += t('summary.missing_address', lang) + `\n`;
          }
          resumen += t('summary.shipping_cost', lang) + `\n`;
        } else {
          resumen += `\n` + t('summary.delivery_type_missing', lang) + `\n`;
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
        
        resumen += `\n💳 *${t('label.payment_method', lang)}:* `;
        if (context.payment_method) {
          const paymentIcons: Record<string, string> = {
            'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳'
          };
          const icon = paymentIcons[context.payment_method.toLowerCase()] || '💰';
          resumen += `${icon} ${context.payment_method.charAt(0).toUpperCase() + context.payment_method.slice(1)}\n`;
        } else {
          resumen += t('summary.payment_not_selected', lang) + `\n`;
          
          if (context.available_payment_methods && context.available_payment_methods.length > 0) {
            resumen += `\n` + t('summary.choose_payment', lang) + `\n`;
            context.available_payment_methods.forEach(method => {
              const methodIcons: Record<string, string> = {
                'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳'
              };
              resumen += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${methodIcons[method] || '💰'}\n`;
            });
            return resumen;
          }
        }
        
        resumen += `\n` + t('summary.total_estimated', lang, { amount: String(subtotal) });
        if (context.delivery_type === 'delivery') {
          resumen += t('summary.plus_shipping', lang);
        }
        resumen += `\n\n`;
        
        const missingInfo = [];
        if (!context.delivery_type) missingInfo.push(t('missing.delivery_type', lang));
        if (context.delivery_type === 'delivery' && !context.delivery_address) missingInfo.push(t('missing.address', lang));
        if (!context.payment_method) missingInfo.push(t('missing.payment', lang));
        
        if (missingInfo.length > 0) {
          resumen += t('summary.missing_info', lang, { items: missingInfo.join(', ') }) + `\n`;
          return resumen;
        }
        
        resumen += t('summary.confirm_question', lang);
        
        context.resumen_mostrado = true;
        await saveContext(context, supabase);
        
        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        resumen += `\n_${t('summary.updated_at', lang, { time: timeStr })}_`;
        
        return resumen;
      }

      case "modificar_carrito_completo": {
        console.log(`🔄 ========== MODIFYING CART COMPLETELY ==========`);
        
        if (!context.selected_vendor_id) {
          return t('shopping.need_vendor_modify', lang);
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
          return t('cart.modify_not_found', lang);
        }
        
        context.cart = newCart;
        
        const total = context.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        
        let response = t('cart.modified', lang, { vendor: context.selected_vendor_name || '' }) + `\n\n`;
        context.cart.forEach(item => {
          response += `• ${item.product_name} x${item.quantity} - $${item.price * item.quantity}\n`;
        });
        response += `\n💰 ${t('cart.total', lang)}: $${total}\n\n` + t('cart.is_correct', lang);
        
        return response;
      }

      case "vaciar_carrito": {
        context.cart = [];
        context.delivery_type = undefined;
        context.conversation_history = [];
        console.log(`🧹 Cart, delivery_type and conversation history cleared`);
        return t('cart.cleared', lang);
      }

      case "seleccionar_tipo_entrega": {
        const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
        console.log(`🔄 Real-time vendor config for ${context.selected_vendor_id}:`, vendorConfig);
        
        if (!vendorConfig.allows_pickup && args.tipo === "pickup") {
          return t('delivery.no_pickup', lang, { vendor: context.selected_vendor_name || '' });
        }
        
        if (!vendorConfig.allows_delivery && args.tipo === "delivery") {
          return t('delivery.no_delivery', lang, { vendor: context.selected_vendor_name || '' });
        }
        
        context.delivery_type = args.tipo;
        await saveContext(context, supabase);
        
        if (args.tipo === "pickup") {
          let respuesta = t('delivery.pickup_set', lang) + `\n\n`;
          respuesta += t('delivery.pickup_location', lang) + `\n${context.selected_vendor_name}\n`;
          
          if (vendorConfig.address) {
            respuesta += `${vendorConfig.address}\n\n`;
            if (vendorConfig.pickup_instructions) {
              respuesta += t('delivery.instructions', lang) + `\n${vendorConfig.pickup_instructions}\n\n`;
            }
          }
          
          if (!context.payment_method) {
            if (context.available_payment_methods && context.available_payment_methods.length > 0) {
              respuesta += t('address.choose_payment', lang) + `\n`;
              context.available_payment_methods.forEach(method => {
                const icons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
                respuesta += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${icons[method] || '💰'}\n`;
              });
            }
          }
          
          return respuesta;
        }
        
        return t('delivery.type_set', lang, { type: args.tipo });
      }

      case "crear_pedido": {
        const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
        if (pendingStates.includes(context.order_state || '')) {
          const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
          return t('order.active_exists', lang, { id: orderId });
        }

        const hasValidPaymentMethod = context.payment_method && 
          context.available_payment_methods?.includes(context.payment_method);
        
        if (context.order_state !== "checkout" && !hasValidPaymentMethod) {
          if (context.payment_methods_fetched && context.available_payment_methods) {
            const methodsList = context.available_payment_methods.map(m => `- ${m}`).join('\n');
            return t('payment.choose_available', lang, { methods: methodsList });
          }
          return t('payment.need_confirm', lang);
        }
        
        if (context.order_state === "shopping" && hasValidPaymentMethod) {
          context.order_state = "checkout";
        }

        if (context.cart.length === 0) {
          return t('order.empty_cart', lang);
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
                stockIssues.push(`❌ *${stockProduct.name}* - ${t('stock.out_label', lang)}`);
              } else {
                stockIssues.push(`⚠️ *${stockProduct.name}* - ${t('stock.ordered_vs_available', lang, { requested: String(cartItem.quantity), available: String(available) })}`);
              }
            }
          }
        }

        if (stockIssues.length > 0) {
          return t('stock.issue_header', lang) +
                 stockIssues.join('\n') +
                 `\n\n` + t('stock.adjust_cart', lang);
        }

        if (!context.selected_vendor_id) {
          return t('order.no_vendor', lang);
        }

        // ✅ SIEMPRE consultar en tiempo real para tipo de entrega
        if (!context.delivery_type) {
          const vendorConfig = await getVendorConfig(context.selected_vendor_id!, supabase);
          
          if (vendorConfig.allows_pickup && vendorConfig.allows_delivery) {
            return t('order.ask_delivery_type', lang);
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
          
          context.delivery_address = `RETIRO EN LOCAL: ${vendorAddr?.address || t('vendors.address_unavailable', lang)}`;
          deliveryCost = 0;
        } else {
          const { data: vendorDel } = await supabase
            .from("vendors")
            .select("delivery_fixed_price")
            .eq("id", context.selected_vendor_id)
            .single();
          
          deliveryCost = Math.round(vendorDel?.delivery_fixed_price || 0);

          if (!args.direccion && !context.delivery_address) {
            return t('delivery.need_address', lang);
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
            return t('order.duplicate', lang, { id: recentOrder.id.substring(0, 8) });
          }
        }

        if (context.delivery_type !== 'pickup' && (!args.direccion || args.direccion.trim() === "")) {
          return t('order.need_address_inline', lang);
        }

        if (!args.metodo_pago) {
          return t('payment.select', lang);
        }

        // ⚠️ VALIDAR método de pago habilitado
        const { data: vendorForPayment, error: vendorPaymentError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorPaymentError || !vendorForPayment) {
          return t('order.payment_validate_error', lang);
        }

        const pSettings = vendorForPayment.payment_settings || {};
        const metodoSolicitado = args.metodo_pago.toLowerCase();

        let metodoValido = false;
        if (metodoSolicitado === "efectivo" && pSettings.efectivo === true) metodoValido = true;
        else if (metodoSolicitado === "transferencia" && pSettings.transferencia?.activo === true) metodoValido = true;
        else if (metodoSolicitado === "mercadopago" && pSettings.mercadoPago?.activo === true) metodoValido = true;

        if (!metodoValido) {
          return t('payment.invalid_with_hint', lang, { method: metodoSolicitado, vendor: vendorForPayment.name });
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
          return t('error.order_create', lang);
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

        let confirmacion = t('order.created', lang) + `\n\n`;
        confirmacion += `📦 ${t('label.order', lang)} #${order.id.substring(0, 8)}\n`;
        confirmacion += t('order.store_label', lang, { vendor: context.selected_vendor_name || '' }) + `\n\n`;

        if (context.delivery_type === 'pickup') {
          confirmacion += `🛒 ${t('cart.total', lang)}: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;
          confirmacion += t('order.pickup_at', lang) + `\n${context.delivery_address}\n\n`;
          if (context.pickup_instructions) {
            confirmacion += `📝 ${context.pickup_instructions}\n\n`;
          }
          confirmacion += `💳 ${t('label.payment', lang)}: ${context.payment_method}\n`;
        } else {
          confirmacion += `🛒 Subtotal: $ ${Math.round(subtotal).toLocaleString("es-PY")}\n`;
          confirmacion += `🚚 Delivery: $ ${Math.round(deliveryCost).toLocaleString("es-PY")}\n`;
          confirmacion += `💰 ${t('cart.total', lang)}: $ ${Math.round(total).toLocaleString("es-PY")}\n\n`;
          confirmacion += `📍 ${t('label.address', lang)}: ${context.delivery_address}\n`;
          confirmacion += `💳 ${t('label.payment', lang)}: ${context.payment_method}\n`;
          if (deliveryCost > 0) {
            confirmacion += `\n` + t('order.delivery_note', lang) + `\n`;
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
            confirmacion += t('order.transfer_data', lang) + `\n\n`;
            confirmacion += `• *Alias:* ${transferData.alias}\n`;
            confirmacion += `• *CBU/CVU:* ${transferData.cbu}\n`;
            confirmacion += `• *${t('label.account_holder', lang)}:* ${transferData.titular}\n\n`;
            confirmacion += t('order.transfer_confirm_prompt', lang);
          } else {
            confirmacion += t('order.transfer_data_error', lang);
          }
        } else if (context.payment_method.toLowerCase().includes("efectivo")) {
          confirmacion += t('order.cash_info', lang);
        } else if (context.payment_method.toLowerCase().includes("mercadopago")) {
          let paymentLinkGenerated = false;
          let paymentLinkUrl = "";
          let paymentErrorMsg = "";
          
          try {
            const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
              body: { orderId: order.id },
            });

            if (paymentError) {
              paymentErrorMsg = t('order.mp_error', lang);
            } else if (paymentData?.success && paymentData?.payment_link) {
              paymentLinkGenerated = true;
              paymentLinkUrl = paymentData.payment_link;
            } else if (paymentData?.available_methods) {
              paymentErrorMsg = t('order.mp_unavailable', lang);
              for (const method of paymentData.available_methods) {
                if (method.method === 'transferencia') {
                  paymentErrorMsg += `📱 *${t('label.bank_transfer', lang)}:*\n• Alias: ${method.details.alias}\n• CBU/CVU: ${method.details.cbu}\n• ${t('label.account_holder', lang)}: ${method.details.titular}\n• ${t('label.amount', lang)}: $${method.details.amount}\n\n`;
                } else if (method.method === 'efectivo') {
                  paymentErrorMsg += `💵 *${t('label.cash', lang)}:* ${method.details.message}\n\n`;
                }
              }
            } else {
              paymentErrorMsg = t('order.mp_link_error', lang);
            }
          } catch (_e) {
            paymentErrorMsg = t('order.mp_error', lang);
          }
          
          if (paymentLinkGenerated) {
            confirmacion += t('order.mp_link_ready', lang, { link: paymentLinkUrl });
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
          return t('status.not_found', lang);
        }
        
        const { data: order, error } = await supabase
          .from("orders")
          .select("*, vendors(name)")
          .eq("id", orderId)
          .single();

        if (error || !order) {
          return t('status.not_found2', lang);
        }

        const statusMap: Record<string, string> = {
          pending: t('status.pending', lang),
          confirmed: t('status.confirmed', lang),
          preparing: t('status.preparing', lang),
          ready: t('status.ready', lang),
          delivered: t('status.delivered', lang),
          cancelled: t('status.cancelled', lang),
        };

        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

        let estado = t('status.header', lang) + `\n\n`;
        estado += `🆔 ${t('label.order', lang)} #${order.id.substring(0, 8)}\n`;
        estado += `🏪 ${t('label.store', lang)}: ${order.vendors.name}\n`;
        estado += `✨ ${t('label.status', lang)}: *${statusMap[order.status] || order.status}*\n`;
        estado += `💰 ${t('cart.total', lang)}: $${Math.round(order.total).toLocaleString("es-AR")}\n\n`;
        estado += `_${t('status.updated_at', lang, { time: timeStr })}_`;

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
            ? t('offers.no_offers_vendor', lang)
            : t('offers.no_offers', lang);
        }

        let resultado = offers.length === 1 
          ? t('offers.count_single', lang) 
          : t('offers.count', lang, { count: String(offers.length) });
        resultado += `\n\n`;

        offers.forEach((offer: any, i: number) => {
          resultado += `${i + 1}. ${offer.title}\n`;
          resultado += `   🏪 ${offer.vendors.name}\n`;
          resultado += `   📝 ${offer.description}\n`;
          if (offer.discount_percentage) resultado += `   💰 ${offer.discount_percentage}% OFF\n`;
          if (offer.original_price && offer.offer_price) resultado += `   💵 ${t('offers.price_before', lang)}: $${offer.original_price} → ${t('offers.price_now', lang)}: $${offer.offer_price}\n`;
          if (offer.valid_until) {
            const validUntil = new Date(offer.valid_until);
            resultado += `   ⏰ ${t('offers.valid_until', lang)}: ${validUntil.toLocaleDateString("es-AR")}\n`;
          }
          resultado += `   ID ${t('label.store', lang)}: ${offer.vendor_id}\n\n`;
        });

        return resultado;
      }

      case "cancelar_pedido": {
        if (!args.motivo) {
          context.pending_cancellation = {
            step: "awaiting_reason",
            order_id: args.order_id || context.pending_order_id || context.last_order_id,
          };
          await saveContext(context, supabase);
          return t('cancel.ask_reason', lang);
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
            return t('cancel.no_active', lang);
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
            return t('cancel.not_found', lang, { id: orderId });
          }
          orderId = matchingOrders[0].id;
        }

        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (fetchError || !order) return t('cancel.not_found2', lang);
        if (order.customer_phone !== context.phone) return t('cancel.not_yours', lang);
        if (order.status === "cancelled") return t('cancel.already_cancelled', lang);
        if (["delivered", "ready"].includes(order.status)) return t('cancel.cannot_cancel', lang, { status: order.status });

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

        return t('cancel.success', lang, { id: orderId.substring(0, 8), reason: args.motivo });
      }

      case "ver_metodos_pago": {
        if (!context.selected_vendor_id) {
          return t('payment.need_vendor', lang);
        }

        context.payment_method = undefined;

        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, payment_settings")
          .eq("id", context.selected_vendor_id)
          .single();

        if (vendorError || !vendor) return t('payment.fetch_error', lang);

        const paymentSettings = vendor.payment_settings || {};
        const metodosDisponibles: string[] = [];
        const availableKeys: string[] = [];
        let datosTransferencia = "";

        if (paymentSettings.efectivo === true) {
          metodosDisponibles.push(`- ${t('label.cash', lang)} 💵`);
          availableKeys.push("efectivo");
        }

        if (paymentSettings.transferencia?.activo === true) {
          metodosDisponibles.push(`- ${t('label.bank_transfer', lang)} 🏦`);
          availableKeys.push("transferencia");
          const { alias, cbu, titular } = paymentSettings.transferencia;
          if (alias && cbu && titular) {
            datosTransferencia = `\n\n📋 *${t('label.transfer_details', lang)}:*\n• Alias: ${alias}\n• CBU/CVU: ${cbu}\n• ${t('label.account_holder', lang)}: ${titular}`;
          }
        }

        if (paymentSettings.mercadoPago?.activo === true) {
          metodosDisponibles.push("- MercadoPago 💳");
          availableKeys.push("mercadopago");
        }

        if (metodosDisponibles.length === 0) {
          return t('payment.not_configured', lang, { vendor: vendor.name });
        }

        context.payment_methods_fetched = true;
        context.available_payment_methods = availableKeys;

        const textoMetodos = metodosDisponibles.length === 1 
          ? t('payment.single_available', lang)
          : t('payment.multiple_available', lang);

        const metodosNumerados = metodosDisponibles.map((m, i) => `${i + 1}. *${m.replace('- ', '')}*`).join('\n');

        const argTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const timeStr = argTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        
        return `${textoMetodos}\n\n${metodosNumerados}${datosTransferencia}\n\n_${t('payment.updated_at', lang, { time: timeStr })}_\n\n${t('payment.choose', lang)}`;
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
          return t('payment.need_methods', lang);
        }
        
        if (!context.available_payment_methods.includes(normalizedMethod)) {
          const available = context.available_payment_methods.map((m, i) => `${i + 1}. ${m}`).join('\n');
          return t('payment.not_available', lang, { method: metodo, available });
        }
        
        context.payment_method = normalizedMethod;
        await saveContext(context, supabase);
        
        const icons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
        const labels: Record<string, string> = { 'efectivo': 'Efectivo', 'transferencia': 'Transferencia', 'mercadopago': 'MercadoPago' };
        
        return `✅ ${t('label.payment_method', lang)}: ${icons[normalizedMethod] || '💰'} ${labels[normalizedMethod] || normalizedMethod}`;
      }

      case "hablar_con_vendedor": {
        let vendorId = context.selected_vendor_id;

        if (!vendorId) {
          return t('chat.need_vendor', lang);
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(vendorId)) {
          const { data: foundVendor } = await supabase
            .from("vendors").select("id, name").ilike("name", `%${vendorId}%`).maybeSingle();

          if (foundVendor) {
            vendorId = foundVendor.id;
            context.selected_vendor_id = foundVendor.id;
          } else {
            return t('chat.vendor_not_found', lang);
          }
        }

        const { data: vendor, error: vendorError } = await supabase
          .from("vendors").select("phone, whatsapp_number, name").eq("id", vendorId).single();

        if (vendorError || !vendor) return t('chat.error', lang);

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

        return t('chat.connected', lang, { vendor: vendor.name });
      }

      case "registrar_calificacion": {
        if (!args.delivery_rating && !args.service_rating && !args.product_rating && !args.comment) {
          return t('rating.need_rating', lang);
        }

        const { data: recentOrder } = await supabase
          .from("orders").select("id, vendor_id")
          .eq("customer_phone", context.phone)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (!recentOrder) return t('rating.no_order', lang);

        const ratings = [args.delivery_rating, args.service_rating, args.product_rating].filter(r => r !== null && r !== undefined);
        const averageRating = ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : null;

        const { error } = await supabase.from("vendor_reviews").insert({
          vendor_id: recentOrder.vendor_id, order_id: recentOrder.id,
          customer_phone: context.phone, customer_name: args.customer_name || context.phone,
          rating: averageRating, delivery_rating: args.delivery_rating,
          service_rating: args.service_rating, product_rating: args.product_rating, comment: args.comment,
        });

        if (error) return t('rating.save_error', lang);

        let respuesta = t('rating.thanks', lang) + `\n`;
        if (args.delivery_rating) respuesta += `${t('rating.delivery', lang)}: ${args.delivery_rating}/5\n`;
        if (args.service_rating) respuesta += `${t('rating.service', lang)}: ${args.service_rating}/5\n`;
        if (args.product_rating) respuesta += `${t('rating.product', lang)}: ${args.product_rating}/5\n`;
        if (args.comment) respuesta += `\n${t('rating.comment', lang)}: "${args.comment}"\n`;
        respuesta += "\n" + t('rating.helps', lang);

        return respuesta;
      }

      case "calificar_plataforma": {
        if (!args.rating || args.rating < 1 || args.rating > 5) {
          return t('platform.invalid_rating', lang);
        }

        const { error } = await supabase.from("platform_reviews").insert({
          user_type: "customer", reviewer_phone: context.phone,
          reviewer_name: args.customer_name || context.phone,
          rating: args.rating, comment: args.comment || null,
        });

        if (error) return t('platform.save_error', lang);

        let respuesta = t('platform.thanks', lang) + `\n\n`;
        respuesta += `⭐ ${t('label.your_rating', lang)}: ${args.rating}/5\n`;
        if (args.comment) respuesta += `\n${t('rating.comment', lang)}: "${args.comment}"\n`;
        respuesta += "\n" + t('platform.helps', lang);

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
          return t('ticket.error', lang);
        }

        await supabase.from("support_messages").insert({
          ticket_id: ticket.id, sender_type: "customer", message: args.descripcion,
        });

        return t('ticket.created', lang, { id: ticket.id.substring(0, 8), subject: args.asunto, priority: prioridad });
      }

      case "mostrar_menu_ayuda": {
        return t('help.full', context.language || 'es');
      }

      case "confirmar_direccion_entrega": {
        console.log("📍 ========== CONFIRMAR DIRECCION ENTREGA ==========");
        
        const direccion = args.direccion?.trim();
        
        if (!direccion || direccion.length < 3) {
          return t('address.too_short', lang);
        }
        
        context.delivery_address = direccion;
        
        if (!context.delivery_type) {
          context.delivery_type = 'delivery';
        }
        
        await saveContext(context, supabase);
        
        let response = t('address.confirmed', lang, { address: direccion }) + `\n\n`;
        
        if (context.cart.length > 0 && context.selected_vendor_id) {
          if (!context.payment_method) {
            if (context.available_payment_methods && context.available_payment_methods.length > 0) {
              response += t('address.choose_payment', lang) + `\n`;
              context.available_payment_methods.forEach(method => {
                const icons: Record<string, string> = { 'efectivo': '💵', 'transferencia': '🏦', 'mercadopago': '💳' };
                response += `- ${method.charAt(0).toUpperCase() + method.slice(1)} ${icons[method] || '💰'}\n`;
              });
            } else {
              response += t('address.confirm_order', lang);
            }
          } else {
            response += t('address.confirm_with_payment', lang, { method: context.payment_method });
          }
        }
        
        return response;
      }

      case "ver_horario_negocio": {
        console.log(`🕐 ========== VER HORARIO NEGOCIO ==========`);

        // Reuse same vendor search logic as ver_menu_negocio
        const searchVendorSchedule = async (searchTerm: string) => {
          if (context.available_vendors_map && context.available_vendors_map.length > 0) {
            const indexNum = parseInt(searchTerm);
            if (!isNaN(indexNum)) {
              const byIndex = context.available_vendors_map.find(v => v.index === indexNum);
              if (byIndex) {
                const { data } = await supabase.from("vendors").select("id, name, address, is_active").eq("id", byIndex.vendor_id).maybeSingle();
                if (data) return data;
              }
            }
            const normalized = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const byName = context.available_vendors_map.find(v => {
              const vNorm = v.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return vNorm.includes(normalized) || normalized.includes(vNorm);
            });
            if (byName) {
              const { data } = await supabase.from("vendors").select("id, name, address, is_active").eq("id", byName.vendor_id).maybeSingle();
              if (data) return data;
            }
          }
          // UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(searchTerm)) {
            const { data } = await supabase.from("vendors").select("id, name, address, is_active").eq("id", searchTerm).maybeSingle();
            if (data) return data;
          }
          // By name
          const { data: allVendors } = await supabase.from("vendors").select("id, name, address, is_active").eq("is_active", true);
          const normalizedSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return allVendors?.find((v: any) => v.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedSearch));
        };

        const vendorSchedule = await searchVendorSchedule(args.vendor_id);
        if (!vendorSchedule) return t('menu.not_found', lang);

        // Fetch all hours for this vendor
        const { data: allHours, error: hoursErr } = await supabase
          .from("vendor_hours")
          .select("day_of_week, opening_time, closing_time, is_closed, is_open_24_hours, slot_number")
          .eq("vendor_id", vendorSchedule.id)
          .order("slot_number");

        if (hoursErr) {
          console.error("Error fetching vendor hours:", hoursErr);
          return t('error.vendor_fetch', lang);
        }

        const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayNames: Record<string, Record<Language, string>> = {
          monday: { es: 'Lunes', en: 'Monday', pt: 'Segunda', ja: '月曜日' },
          tuesday: { es: 'Martes', en: 'Tuesday', pt: 'Terça', ja: '火曜日' },
          wednesday: { es: 'Miércoles', en: 'Wednesday', pt: 'Quarta', ja: '水曜日' },
          thursday: { es: 'Jueves', en: 'Thursday', pt: 'Quinta', ja: '木曜日' },
          friday: { es: 'Viernes', en: 'Friday', pt: 'Sexta', ja: '金曜日' },
          saturday: { es: 'Sábado', en: 'Saturday', pt: 'Sábado', ja: '土曜日' },
          sunday: { es: 'Domingo', en: 'Sunday', pt: 'Domingo', ja: '日曜日' },
        };

        let result = t('schedule.header', lang, { vendor: vendorSchedule.name }) + `\n\n`;

        // Current time in Argentina
        const nowSch = new Date();
        const argTimeSch = new Date(nowSch.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const currentDaySch = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][argTimeSch.getDay()];
        const currentTimeSch = argTimeSch.toTimeString().slice(0, 5);

        if (!allHours || allHours.length === 0) {
          result += t('schedule.no_hours', lang);
        } else {
          // Group hours by day
          const hoursByDay = new Map<string, any[]>();
          for (const h of allHours) {
            const day = h.day_of_week.toLowerCase();
            if (!hoursByDay.has(day)) hoursByDay.set(day, []);
            hoursByDay.get(day)!.push(h);
          }

          for (const day of dayOrder) {
            const dayLabel = dayNames[day]?.[lang] || day;
            const isToday = day === currentDaySch;
            const slots = hoursByDay.get(day);

            if (!slots || slots.length === 0 || slots.every((s: any) => s.is_closed)) {
              result += `${isToday ? '👉 ' : ''}${dayLabel}: ❌ ${t('schedule.closed', lang)}\n`;
            } else {
              const timeSlots = slots
                .filter((s: any) => !s.is_closed)
                .map((s: any) => s.is_open_24_hours ? '24hs' : `${s.opening_time.slice(0, 5)} - ${s.closing_time.slice(0, 5)}`);
              result += `${isToday ? '👉 ' : ''}${dayLabel}: ${timeSlots.join(', ')}\n`;
            }
          }

          // Check if open now
          const todaySlots = hoursByDay.get(currentDaySch);
          if (todaySlots) {
            const isOpenNow = todaySlots.some((s: any) => {
              if (s.is_closed) return false;
              if (s.is_open_24_hours) return true;
              return currentTimeSch >= s.opening_time.slice(0, 5) && currentTimeSch <= s.closing_time.slice(0, 5);
            });
            result += `\n${isOpenNow ? t('schedule.currently_open', lang) : t('schedule.currently_closed', lang)}`;
          }
        }

        if (vendorSchedule.address) {
          result += `\n📍 ${vendorSchedule.address}`;
        }

        return result;
      }

      default:
        return `Herramienta ${toolName} no implementada`;
    }
  } catch (error) {
    console.error(`Error ejecutando ${toolName}:`, error);
    return `Error al ejecutar ${toolName}: ${error.message}`;
  }
}
