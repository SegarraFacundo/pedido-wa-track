// ==================== AGENTE PRINCIPAL ====================
// Modularized: imports from bot-helpers.ts, tool-handlers.ts, emergency.ts

import OpenAI from "https://esm.sh/openai@4.77.3";
import { ConversationContext } from "./types.ts";
import { normalizeArgentinePhone } from "./utils.ts";
import { getContext, saveContext } from "./context.ts";
import { buildSystemPrompt } from "./simplified-prompt.ts";
import { t, detectLanguage, detectExplicitLanguageRequest, HELP_REGEX, isConfirmation, isCancellation, detectPaymentMethod, Language } from "./i18n.ts";

import { DIRECT_RESPONSE_TOOLS, filterToolsByState, handleShoppingInterceptor, trackVendorChange } from "./bot-helpers.ts";
import { ejecutarHerramienta } from "./tool-handlers.ts";
import { checkPlatformSettings, logBotError, incrementErrorCount, handleEmergencyFallback } from "./emergency.ts";

export async function handleVendorBot(message: string, phone: string, supabase: any, imageUrl?: string): Promise<string> {
  const normalizedPhone = normalizeArgentinePhone(phone);
  console.log("🤖 AI Bot START - Phone:", normalizedPhone, "Message:", message, "ImageUrl:", imageUrl);

  try {
    // 🚨 EMERGENCY CHECK: Verify platform settings before processing
    const platformSettings = await checkPlatformSettings(supabase);
    
    if (platformSettings) {
      if (!platformSettings.bot_enabled || platformSettings.emergency_mode) {
        console.log(`🚨 Bot disabled or emergency mode active`);
        
        await logBotError(
          supabase,
          platformSettings.emergency_mode ? 'EMERGENCY_MODE' : 'BOT_DISABLED',
          `Bot is ${platformSettings.emergency_mode ? 'in emergency mode' : 'disabled'}. Customer message: "${message.substring(0, 100)}"`,
          normalizedPhone
        );
        
        return await handleEmergencyFallback(platformSettings, normalizedPhone, message, supabase);
      }
    }

    // 🔄 COMANDO DE REINICIO
    const resetCommands = ['reiniciar', 'empezar de nuevo', 'borrar todo', 'limpiar memoria', 'reset', 'comenzar de nuevo', 'nuevo pedido', 'empezar'];
    const normalizedMessage = message.toLowerCase().trim();
    
    if (resetCommands.some(cmd => normalizedMessage.includes(cmd))) {
      console.log('🔄 Reset command detected, clearing user memory...');
      
      await supabase
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
      
      // Detect language from the reset command itself
      const resetLang = detectLanguage(message) as Language;
      return t('reset.done', resetLang);
    }
    
    // Cargar contexto
    const context = await getContext(normalizedPhone, supabase);
    
    // 🔄 VALIDACIÓN DE SINCRONIZACIÓN
    if (context.pending_order_id) {
      const { data: orderCheck } = await supabase
        .from("orders")
        .select("status")
        .eq("id", context.pending_order_id)
        .single();
      
      if (!orderCheck || ['cancelled', 'delivered'].includes(orderCheck.status)) {
        console.log(`🔄 Detected stale order state - cleaning context`);
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
      }
    }
    
    // ⚠️ VALIDACIÓN AUTOMÁTICA: Limpiar payment_method si es inválido
    if (context.payment_method && 
        context.available_payment_methods?.length > 0 &&
        !context.available_payment_methods.includes(context.payment_method)) {
      console.warn(`⚠️ INCONSISTENCY: payment_method="${context.payment_method}" not in available`);
      context.payment_method = undefined;
      await saveContext(context, supabase);
    }
    
    // 🌐 IDIOMA: Default español. Solo cambia si el usuario lo pide explícitamente.
    if (!context.language) {
      context.language = 'es';
    }
    const explicitLangRequest = detectExplicitLanguageRequest(message);
    if (explicitLangRequest && explicitLangRequest !== context.language) {
      context.language = explicitLangRequest;
      console.log(`🌐 Language explicitly changed to: ${context.language}`);
      await saveContext(context, supabase);
      // Respond immediately confirming the language change
      return t('language.changed', context.language);
    }
    
    // 🛡️ RESET DEFENSIVO: Si el idioma no es español y el usuario NO pidió otro idioma
    // en este mensaje, resetear a español (corrige sesiones legacy pegadas en otro idioma)
    if (context.language !== 'es' && !explicitLangRequest) {
      console.log(`🛡️ Defensive language reset: ${context.language} → es (no explicit request in this message)`);
      context.language = 'es';
      // No need to save yet, will be saved later
    }
    
    const lang = (context.language || 'es') as Language;

    // 🧹 LIMPIAR CONTEXTO si hay un pedido ACTIVO del mismo vendor
    if (context.selected_vendor_id || context.cart.length > 0) {
      let shouldClearContext = false;
      
      const safeStates = ['idle', 'order_completed', 'order_cancelled'];
      const isInSafeState = !context.order_state || safeStates.includes(context.order_state);
      
      if (context.selected_vendor_id && isInSafeState) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id, status, created_at, vendor_id')
          .eq('customer_phone', normalizedPhone)
          .eq('vendor_id', context.selected_vendor_id)
          .in('status', ['pending', 'preparing', 'ready', 'in_transit'])
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (activeOrders && activeOrders.length > 0) {
          const activeOrder = activeOrders[0];
          if (activeOrder.id !== context.pending_order_id) {
            shouldClearContext = true;
          }
        }
      }
      
      // Verificar si el vendor todavía existe y está activo
      if (context.selected_vendor_id && !shouldClearContext) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, name, is_active, payment_status')
          .eq('id', context.selected_vendor_id)
          .maybeSingle();
        
        if (!vendor || !vendor.is_active || vendor.payment_status !== 'active') {
          shouldClearContext = true;
        }
      }
      
      if (shouldClearContext) {
        console.log('🧹 ========== CLEARING CONTEXT ==========');
        context.cart = [];
        context.selected_vendor_id = undefined;
        context.selected_vendor_name = undefined;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.pending_order_id = undefined;
        context.order_state = 'idle';
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.delivery_type = undefined;
        context.vendor_allows_pickup = undefined;
        context.pickup_instructions = undefined;
        context.conversation_history = [];
        await saveContext(context, supabase);
      }
    }
    
    // 📄 MANEJO ESPECIAL: Comprobante recibido
    if (message === 'comprobante_recibido' && imageUrl && context.pending_order_id) {
      console.log('💳 Processing payment receipt for order:', context.pending_order_id);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_receipt_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', context.pending_order_id);
      
      if (updateError) {
        return t('receipt.error', lang);
      }
      
      context.payment_receipt_url = imageUrl;
      await saveContext(context, supabase);
      
      return t('receipt.success', lang);
    }

    console.log("📋 Context loaded:", {
      phone: context.phone,
      cartItems: context.cart.length,
      vendor: context.selected_vendor_name,
      historyLength: context.conversation_history.length,
    });

    // 🚫 VALIDACIÓN TEMPRANA: Bloquear pedidos duplicados cuando hay uno activo
    const pendingStates = ['order_pending_cash', 'order_pending_transfer', 'order_pending_mp', 'order_confirmed'];
    const newOrderIntentRegex = /\b(quiero\s+(hacer\s+)?(un\s+)?pedido|nuevo\s+pedido|hacer\s+pedido|quiero\s+comprar|ver\s+(locales|negocios|tiendas)|ver\s*men[uú]|show\s+(stores|shops)|show\s*menu|new\s+order|novo\s+pedido)\b/i;
    const cancelIntentRegex = /\b(cancelar\s+(mi\s+|el\s+)?pedido|quiero\s+cancelar|cancela\s+mi\s+pedido|cancel\s+order|cancel\s+my\s+order|cancelamento|注文キャンセル)\b/i;
    const statusIntentRegex = /\b(estado(?:\s+de\s+mi\s+pedido)?|mi\s+pedido|order\s*status|status(?:\s+do\s+pedido)?|status|pedido\s+status|注文状況)\b/i;
    const vendorChatIntentRegex = /\b(hablar\s+con\s+(vendedor|negocio|local)|contactar\s+(negocio|vendedor)|talk\s+to\s+(vendor|store)|falar\s+com\s+(vendedor|loja)|店舗に連絡)\b/i;

    if (pendingStates.includes(context.order_state || '')) {
      const messageLower = message.toLowerCase().trim();

      // 🕐 INTERCEPTOR: Horario (allowed even with active order)
      const scheduleRegexPending = /\b(horarios?|schedule|horários?|営業時間|a qu[eé] hora|what time|when.*open|cuando abre|que hora)\b/i;
      if (scheduleRegexPending.test(messageLower)) {
        if (context.selected_vendor_id) {
          const result = await ejecutarHerramienta("ver_horario_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }

      // ⭐ INTERCEPTOR: Rating (allowed even with active order)
      const rateOrderRegex = /\b(calificar\s+(mi\s+)?(orden|pedido)|rate\s+(my\s+)?(order)|avaliar\s+(meu\s+)?pedido|注文.*評価)\b/i;
      const ratePlatformRegex = /\b(calificar\s+(a\s+)?lapacho|calificar\s+(la\s+)?plataforma|rate\s+lapacho|rate\s+(the\s+)?platform|avaliar\s+(o\s+)?lapacho|Lapacho.*評価)\b/i;
      if (rateOrderRegex.test(messageLower)) {
        const response = t('rating.prompt_order', lang);
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      if (ratePlatformRegex.test(messageLower)) {
        const response = t('rating.prompt_platform', lang);
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }

      // 🔴 INTERCEPTOR: Cancelar
      const wantsCancel = cancelIntentRegex.test(messageLower);
      if (wantsCancel && !context.pending_cancellation) {
        context.pending_cancellation = {
          step: "awaiting_reason",
          order_id: context.pending_order_id || context.last_order_id,
        };
        await saveContext(context, supabase);
        return t('cancel.ask_reason', lang);
      }

      // 📦 INTERCEPTOR: Estado
      const wantsStatus = statusIntentRegex.test(messageLower);
      if (wantsStatus) {
        const statusResult = await ejecutarHerramienta("ver_estado_pedido", {}, context, supabase);
        context.conversation_history.push({ role: "assistant", content: statusResult });
        await saveContext(context, supabase);
        return statusResult;
      }

      // 🗣️ INTERCEPTOR: Vendor chat
      const wantsVendorChat = vendorChatIntentRegex.test(messageLower);
      if (wantsVendorChat) {
        const chatResult = await ejecutarHerramienta("hablar_con_vendedor", {}, context, supabase);
        context.conversation_history.push({ role: "assistant", content: chatResult });
        await saveContext(context, supabase);
        return chatResult;
      }

      const wantsNewOrder = newOrderIntentRegex.test(messageLower);
      if (wantsNewOrder && !context.pending_cancellation) {
        const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
        const stateDisplay = context.order_state?.replace('order_pending_', '').replace('_', ' ').toUpperCase() || 'ACTIVO';
        return t('active_order.blocked', lang, { id: orderId, status: stateDisplay });
      }

      // 🧭 FALLBACK determinista
      const isHelpRequest = /^(ayuda|help|menu|opciones|\?|info)/i.test(messageLower);
      if (!isHelpRequest && context.order_state !== 'order_pending_transfer' && !context.pending_cancellation) {
        const orderId = context.pending_order_id ? context.pending_order_id.substring(0, 8) : 'activo';
        return t('active_order.fallback', lang, { id: orderId });
      }
    }

    // Agregar mensaje del usuario al historial
    context.conversation_history.push({ role: "user", content: message });

    // 🔄 MANEJO ESPECIAL: Confirmación de cambio de negocio
    if (context.pending_vendor_change) {
      const userResponse = message.toLowerCase().trim();
      
      if (userResponse.match(/^(s[ií]|si|yes|dale|ok|confirmo|cambio)/)) {
        await trackVendorChange(context, 'confirmed', supabase);
        
        context.cart = [];
        context.selected_vendor_id = context.pending_vendor_change.new_vendor_id;
        context.selected_vendor_name = context.pending_vendor_change.new_vendor_name;
        context.payment_method = undefined;
        context.delivery_address = undefined;
        context.payment_methods_fetched = false;
        context.available_payment_methods = [];
        context.pending_vendor_change = undefined;
        context.order_state = "browsing";
        context.conversation_history = [];
        await saveContext(context, supabase);
        
        const response = t('vendor_change.confirmed', lang, { vendor: context.selected_vendor_name || '' });
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      if (userResponse.match(/^(no|nop|cancel|cancela)/)) {
        await trackVendorChange(context, 'cancelled', supabase);
        context.pending_vendor_change = undefined;
        await saveContext(context, supabase);
        
        const response = t('vendor_change.cancelled', lang, { vendor: context.selected_vendor_name || '' });
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      const clarificationResponse = t('vendor_change.clarify', lang, {
        new_vendor: context.pending_vendor_change.new_vendor_name,
        current_vendor: context.selected_vendor_name || '',
      });
      context.conversation_history.push({ role: "assistant", content: clarificationResponse });
      await saveContext(context, supabase);
      return clarificationResponse;
    }

    // 🔄 MANEJO PROGRAMATICO: Flujo de cancelación
    if (context.pending_cancellation) {
      const userResponse = message.trim();
      const userResponseLower = userResponse.toLowerCase();
      
      if (context.pending_cancellation.step === "awaiting_reason") {
        const orderId = context.pending_cancellation.order_id || context.pending_order_id || context.last_order_id;
        const orderShort = orderId ? orderId.substring(0, 8) : '???';
        
        context.pending_cancellation = {
          step: "awaiting_confirmation",
          reason: userResponse,
          order_id: orderId,
        };
        await saveContext(context, supabase);
        
        const response = t('cancel.confirm_prompt', lang, { id: orderShort, reason: userResponse });
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      if (context.pending_cancellation.step === "awaiting_confirmation") {
        const isConfirm = /^(s[ií]|si|yes|dale|ok|confirmo|confirmar|vamos)$/i.test(userResponseLower);
        const isDeny = /^(no|nop|nel|cancelar cancelacion|mejor no|dejá|deja)$/i.test(userResponseLower);
        
        if (isConfirm) {
          const result = await ejecutarHerramienta("cancelar_pedido", {
            motivo: context.pending_cancellation.reason,
            order_id: context.pending_cancellation.order_id,
          }, context, supabase);
          
          context.pending_cancellation = undefined;
          await saveContext(context, supabase);
          return result;
        }
        
        if (isDeny) {
          context.pending_cancellation = undefined;
          await saveContext(context, supabase);
          
          const response = t('cancel.keep', lang);
          context.conversation_history.push({ role: "assistant", content: response });
          await saveContext(context, supabase);
          return response;
        }
        
        const clarification = t('cancel.confirm_clarify', lang);
        context.conversation_history.push({ role: "assistant", content: clarification });
        await saveContext(context, supabase);
        return clarification;
      }
    }

    // 🏪 INTERCEPTOR: Shopping + quiere ver locales → si carrito vacío, resetear a idle
    if (context.order_state === "shopping") {
      const msgLower = message.toLowerCase().trim();
      const wantsBrowseStores = /\b(ver\s+(locales|negocios|tiendas|comercios)|locales\s+abiertos|qu[eé]\s+hay\s+abierto|show\s+(stores|shops)|ver\s+opciones|otros?\s+(locales?|negocios?)|cambiar\s+de\s+(local|negocio))\b/i.test(msgLower);
      
      if (wantsBrowseStores) {
        if (context.cart.length === 0) {
          // Carrito vacío → resetear a idle y mostrar locales
          console.log('🏪 User wants to browse stores with empty cart, resetting to idle');
          context.order_state = "idle";
          context.selected_vendor_id = undefined;
          context.selected_vendor_name = undefined;
          context.payment_method = undefined;
          context.delivery_address = undefined;
          context.delivery_type = undefined;
          context.payment_methods_fetched = false;
          context.available_payment_methods = [];
          context.resumen_mostrado = false;
          context.conversation_history = [];
          await saveContext(context, supabase);
          
          const storesResult = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
          context.conversation_history.push({ role: "assistant", content: storesResult });
          await saveContext(context, supabase);
          return storesResult;
        } else {
          // Carrito con items → advertir que perderá el carrito
          const response = t('shopping.wrong_vendor', lang, { vendor: context.selected_vendor_name || '' });
          context.conversation_history.push({ role: "assistant", content: response });
          await saveContext(context, supabase);
          return response;
        }
      }
    }

    // 🏪 INTERCEPTOR: Cambio de negocio en shopping → bloquear
    if (context.order_state === "shopping" && context.selected_vendor_id && context.available_vendors_map && context.available_vendors_map.length > 0) {
      const msgLower = message.toLowerCase().trim();
      const otherVendor = context.available_vendors_map.find(v => 
        v.vendor_id !== context.selected_vendor_id && 
        (msgLower.includes(v.name.toLowerCase()) || 
         // Also check if user sends a number that matches another vendor's index
         (msgLower.match(/^(\d+)$/) && parseInt(msgLower) === v.index))
      );
      if (otherVendor) {
        const response = t('shopping.wrong_vendor', lang, { vendor: context.selected_vendor_name || '' });
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
    }

    // 🛒 INTERCEPTOR: Shopping + número/producto
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      const shoppingResult = await handleShoppingInterceptor(message, context, supabase);
      if (shoppingResult) {
        context.conversation_history.push({ role: "assistant", content: shoppingResult });
        await saveContext(context, supabase);
        return shoppingResult;
      }
    }

    // Confirmación post-resumen
    if (context.resumen_mostrado && !context.pending_order_id) {
      const userResponse = message.toLowerCase().trim();
      const isConfirmRes = /^(s[ií]|si|yes|dale|ok|confirmo|listo|confirmar|vamos|va|claro|obvio|seguro|por supuesto|manda|dale que si)\b/i.test(userResponse);
      const isCancelRes = /^(no\b|nop|cancel|cancela|cambiar)/i.test(userResponse);
      
      if (isConfirmRes) {
        const result = await ejecutarHerramienta("crear_pedido", {
          direccion: context.delivery_address || '',
          metodo_pago: context.payment_method
        }, context, supabase);
        await saveContext(context, supabase);
        return result;
      }
      
      if (isCancelRes) {
        context.resumen_mostrado = false;
        await saveContext(context, supabase);
      }
    }

    // 🔄 MANEJO ESPECIAL: order_pending_mp + link de pago
    if (context.order_state === "order_pending_mp") {
      const userMessage = message.toLowerCase().trim();
      
      if (userMessage.match(/link|pag(o|ar|ame)|mercadopago|mp/i)) {
        if (!context.pending_order_id) {
          return t('mp.no_pending', lang);
        }
        
        try {
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke("generate-payment-link", {
            body: { orderId: context.pending_order_id },
          });
          
          let response = "";
          
          if (paymentError) {
            response = t('mp.error', lang);
          } else if (paymentData?.success && paymentData?.payment_link) {
            response = t('mp.link_header', lang, { link: paymentData.payment_link });
          } else if (paymentData?.available_methods) {
            response = t('order.mp_unavailable', lang);
            for (const method of paymentData.available_methods) {
              if (method.method === 'transferencia') {
                response += `📱 *${t('label.bank_transfer', lang)}:*\n• Alias: ${method.details.alias}\n• CBU/CVU: ${method.details.cbu}\n• ${t('label.account_holder', lang)}: ${method.details.titular}\n• ${t('label.amount', lang)}: $${method.details.amount}\n\n`;
              } else if (method.method === 'efectivo') {
                response += `💵 *${t('label.cash', lang)}:* ${method.details.message}\n\n`;
              }
            }
          } else {
            response = t('mp.not_generated', lang);
          }
          
          context.conversation_history.push({ role: "assistant", content: response });
          await saveContext(context, supabase);
          return response;
        } catch (_error) {
          return t('mp.request_error', lang);
        }
      }
    }

    // 🔍 VALIDACIÓN: Confirmar pedido sin carrito
    const confirmPhrases = ['confirmar', 'confirmo', 'listo', 'eso es todo', 'si confirmo', 'confirma', 'dale'];
    const normalizedMsgConfirm = message.toLowerCase().trim();
    const isConfirming = confirmPhrases.some(phrase => normalizedMsgConfirm.includes(phrase));

    if (isConfirming && context.order_state === 'shopping') {
      if (context.cart.length === 0) {
        const emptyCartResponse = t('confirm.empty_cart', lang, { vendor: context.selected_vendor_name || '' });
        context.conversation_history.push({ role: "assistant", content: emptyCartResponse });
        await saveContext(context, supabase);
        return emptyCartResponse;
      }
      
      if (context.resumen_mostrado && context.delivery_type && context.payment_method) {
        const orderResult = await ejecutarHerramienta("crear_pedido", {
          direccion: context.delivery_address || '',
          metodo_pago: context.payment_method
        }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: orderResult });
        await saveContext(context, supabase);
        return orderResult;
      }
      
      if (context.delivery_type && context.payment_method && !context.resumen_mostrado) {
        const resumenResult = await ejecutarHerramienta("mostrar_resumen_pedido", {}, context, supabase);
        context.conversation_history.push({ role: "assistant", content: resumenResult });
        await saveContext(context, supabase);
        return resumenResult;
      }
      
      const cartSummary = await ejecutarHerramienta("ver_carrito", {}, context, supabase);
      let confirmResponse = cartSummary;
      
      if (!context.delivery_type) {
        confirmResponse += "\n\n" + t('delivery.ask_type', lang);
      } else if (context.delivery_type === 'delivery' && !context.delivery_address) {
        confirmResponse += "\n\n" + t('delivery.ask_address', lang);
      } else if (!context.payment_method) {
        const paymentResult = await ejecutarHerramienta("ver_metodos_pago", {}, context, supabase);
        confirmResponse += "\n\n" + paymentResult;
      }
      
      context.conversation_history.push({ role: "assistant", content: confirmResponse });
      await saveContext(context, supabase);
      return confirmResponse;
    }

    // ⭐ BUG FIX #3: Pickup + dirección
    if (context.delivery_type === 'pickup' && 
        context.order_state === 'checkout' &&
        !context.payment_method &&
        message.match(/\d{2,}/) && !message.match(/^[123]$/)) {
      const pickupReminder = t('pickup.reminder', lang, { vendor: context.selected_vendor_name || '' });
      context.conversation_history.push({ role: "assistant", content: pickupReminder });
      await saveContext(context, supabase);
      return pickupReminder;
    }

    // 🔍 DETECCIÓN AUTOMÁTICA: Método de pago
    if (context.payment_methods_fetched && !context.payment_method && 
        (context.delivery_address || context.delivery_type === 'pickup')) {
      const normalizedMsg = message.toLowerCase().trim();
      let selectedMethod: string | null = null;
      
      if (/^[123]$/.test(normalizedMsg) && context.available_payment_methods && context.available_payment_methods.length > 0) {
        const index = parseInt(normalizedMsg) - 1;
        if (index >= 0 && index < context.available_payment_methods.length) {
          selectedMethod = context.available_payment_methods[index];
        }
      }
      
      if (!selectedMethod) {
        selectedMethod = detectPaymentMethod(normalizedMsg);
      }
      
      if (!selectedMethod) {
        if (isConfirmation(normalizedMsg) && context.available_payment_methods?.length === 1) {
          selectedMethod = context.available_payment_methods[0];
        }
      }
      
      if (selectedMethod) {
        if (!context.available_payment_methods || !context.available_payment_methods.includes(selectedMethod)) {
          const availableList = context.available_payment_methods?.map(m => `- ${m}`).join('\n') || '- (ninguno disponible)';
          const errorResponse = t('payment.invalid', lang, { method: selectedMethod, vendor: context.selected_vendor_name || '' }) + `\n\n${availableList}`;
          context.conversation_history.push({ role: "assistant", content: errorResponse });
          await saveContext(context, supabase);
          return errorResponse;
        }
        
        context.payment_method = selectedMethod;
        await saveContext(context, supabase);
        
        const orderAddress = context.delivery_type === 'pickup' 
          ? `${t('delivery.pickup_label', lang)}: ${context.selected_vendor_name}` 
          : context.delivery_address;
        
        try {
          const orderResult = await ejecutarHerramienta("crear_pedido", {
            direccion: orderAddress,
            metodo_pago: selectedMethod
          }, context, supabase);
          
          context.conversation_history.push({ role: "assistant", content: orderResult });
          await saveContext(context, supabase);
          return orderResult;
        } catch (_error) {
          return t('error.order_create', lang);
        }
      }
    }

    // 🔄 MANEJO ESPECIAL: Confirmación de transferencia bancaria
    if (context.order_state === "order_pending_transfer") {
      const userResponse = message.toLowerCase().trim();
      
      if (userResponse.match(/transfer/i) && !isConfirmation(userResponse) && !isCancellation(userResponse)) {
        const reminder = t('transfer.reminder', lang);
        context.conversation_history.push({ role: "assistant", content: reminder });
        return reminder;
      }
      
      if (isConfirmation(userResponse) || userResponse.match(/^(perfecto|continua|continuar)/)) {
        context.order_state = "order_confirmed";
        await saveContext(context, supabase);
        const response = t('transfer.confirmed', lang);
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      if (isCancellation(userResponse) || userResponse.match(/^(cancela|cancelar)/)) {
        if (context.pending_order_id) {
          await supabase.from("orders").update({ status: "cancelled" }).eq("id", context.pending_order_id);
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
        context.conversation_history = [];
        await saveContext(context, supabase);
        
        const response = t('order.cancelled', lang);
        context.conversation_history.push({ role: "assistant", content: response });
        await saveContext(context, supabase);
        return response;
      }
      
      const clarificationResponse = t('transfer.clarify', lang);
      context.conversation_history.push({ role: "assistant", content: clarificationResponse });
      await saveContext(context, supabase);
      return clarificationResponse;
    }

    // 🎯 FASE 2: Interceptores deterministas pre-LLM
    
    // INTERCEPTOR: needs_address
    if ((context.order_state === "needs_address" || 
        (context.order_state === "shopping" && context.delivery_type === "delivery" && !context.delivery_address && context.cart.length > 0)) 
        && message.trim().length > 3) {
      const msgLower = message.toLowerCase().trim();
      const notAddress = /^(cancel|volver|cambiar|no|menu|carrito|ayuda|estado|hola)/i.test(msgLower);
      
      if (!notAddress) {
        const result = await ejecutarHerramienta("confirmar_direccion_entrega", {
          direccion: message.trim(),
        }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }

    // INTERCEPTOR: Rating keywords → prompt for ratings (before LLM)
    const rateOrderRegexGeneral = /\b(calificar\s+(mi\s+)?(orden|pedido)|rate\s+(my\s+)?(order)|avaliar\s+(meu\s+)?pedido|注文.*評価)\b/i;
    const ratePlatformRegexGeneral = /\b(calificar\s+(a\s+)?lapacho|calificar\s+(la\s+)?plataforma|rate\s+lapacho|rate\s+(the\s+)?platform|avaliar\s+(o\s+)?lapacho|Lapacho.*評価)\b/i;
    
    if (ratePlatformRegexGeneral.test(message)) {
      // Check if it's a single number (platform rating response)
      const platformRatingMatch = message.match(/(\d)\s*(.*)/);
      if (platformRatingMatch) {
        const rating = parseInt(platformRatingMatch[1]);
        const comment = platformRatingMatch[2]?.trim() || undefined;
        if (rating >= 1 && rating <= 5) {
          const result = await ejecutarHerramienta("calificar_plataforma", { rating, comment }, context, supabase);
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }
      const response = t('rating.prompt_platform', lang);
      context.conversation_history.push({ role: "assistant", content: response });
      await saveContext(context, supabase);
      return response;
    }
    
    if (rateOrderRegexGeneral.test(message)) {
      const response = t('rating.prompt_order', lang);
      context.conversation_history.push({ role: "assistant", content: response });
      await saveContext(context, supabase);
      return response;
    }

    // INTERCEPTOR: Rating patterns (e.g., "5-5-5", "4 4 4", "rate 5 5 5")
    if (context.order_state === "idle" || context.order_state === "order_completed" || !context.order_state) {
      const ratingPattern = /(?:rat[ei]|review|calific|reseña|rese[nñ]a|評価)?\s*(\d)[\/\-\s,]+(\d)[\/\-\s,]+(\d)/i;
      const ratingMatch = message.match(ratingPattern);
      if (ratingMatch) {
        const [, d, s, p] = ratingMatch;
        const delivery = Math.min(5, Math.max(1, parseInt(d)));
        const service = Math.min(5, Math.max(1, parseInt(s)));
        const product = Math.min(5, Math.max(1, parseInt(p)));
        
        // Extract optional comment after the ratings
        const commentMatch = message.replace(ratingMatch[0], '').trim();
        const comment = commentMatch.length > 2 ? commentMatch : undefined;
        
        const result = await ejecutarHerramienta("registrar_calificacion", {
          delivery_rating: delivery,
          service_rating: service,
          product_rating: product,
          comment,
        }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }

    // INTERCEPTOR: Single number platform rating (after prompt) - works in ANY state
    {
      const lastAssistant = context.conversation_history
        .filter(m => m.role === 'assistant')
        .slice(-1)[0];
      if (lastAssistant?.content?.includes('⭐') && lastAssistant?.content?.includes('1 ⭐')) {
        const singleRating = message.trim().match(/^(\d)\s*(.*)?$/);
        if (singleRating) {
          const rating = parseInt(singleRating[1]);
          const comment = singleRating[2]?.trim() || undefined;
          if (rating >= 1 && rating <= 5) {
            const result = await ejecutarHerramienta("calificar_plataforma", { rating, comment }, context, supabase);
            context.conversation_history.push({ role: "assistant", content: result });
            await saveContext(context, supabase);
            return result;
          }
        }
      }
    }

    // INTERCEPTOR: Food keywords in idle/browsing
    if ((context.order_state === "idle" || context.order_state === "browsing" || !context.order_state) && !context.selected_vendor_id) {
      const foodKeywords = /\b(pizza|hamburguesa|empanada|milanesa|sushi|helado|cerveza|coca|fanta|sprite|agua|café|cafe|pollo|asado|lomito|sandwich|tarta|torta|postre|ensalada|papas|sándwich|medialunas?|facturas?|alfajor|ravioles?|ñoquis?|pastas?)\b/i;
      if (foodKeywords.test(message)) {
        const result = await ejecutarHerramienta("buscar_productos", { consulta: message.trim() }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }
    
    // INTERCEPTOR: Browsing + número → seleccionar negocio
    if (context.order_state === "browsing" && context.available_vendors_map && context.available_vendors_map.length > 0) {
      const numMatch = message.trim().match(/^(\d+)$/);
      if (numMatch) {
        const idx = parseInt(numMatch[1]);
        const vendor = context.available_vendors_map.find(v => v.index === idx);
        if (vendor) {
          const result = await ejecutarHerramienta("ver_menu_negocio", { vendor_id: String(idx) }, context, supabase);
          context.conversation_history.push({ role: "assistant", content: result });
          await saveContext(context, supabase);
          return result;
        }
      }
    }

    // INTERCEPTOR: Shopping + "menú"/"menu"/"show menu" → mostrar menú del vendor actual
    if (context.order_state === "shopping" && context.selected_vendor_id) {
      const menuRequest = /^(men[uú]|show\s*menu|ver\s*men[uú]|cardápio|メニュー)$/i;
      if (menuRequest.test(message.trim())) {
        const result = await ejecutarHerramienta("ver_menu_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
    }

    // INTERCEPTOR: Schedule/horario keywords
    const scheduleRegex = /\b(horarios?|schedule|horários?|営業時間|a qu[eé] hora|what time|when.*open|cuando abre|que hora)\b/i;
    if (scheduleRegex.test(message.trim())) {
      // If user has a selected vendor, show that vendor's schedule
      if (context.selected_vendor_id) {
        const result = await ejecutarHerramienta("ver_horario_negocio", { vendor_id: context.selected_vendor_id }, context, supabase);
        context.conversation_history.push({ role: "assistant", content: result });
        await saveContext(context, supabase);
        return result;
      }
      // If in browsing with vendor map, ask which one
      if (context.available_vendors_map && context.available_vendors_map.length > 0) {
        const askResponse = t('schedule.ask_vendor', lang);
        context.conversation_history.push({ role: "assistant", content: askResponse });
        await saveContext(context, supabase);
        return askResponse;
      }
      // Otherwise show stores first
      const storesResult = await ejecutarHerramienta("ver_locales_abiertos", {}, context, supabase);
      const response = storesResult + "\n\n" + t('schedule.ask_vendor', lang);
      context.conversation_history.push({ role: "assistant", content: response });
      await saveContext(context, supabase);
      return response;
    }

    if (HELP_REGEX.test(message.trim())) {
      const helpText = t('help.full', lang);
      context.conversation_history.push({ role: "assistant", content: helpText });
      await saveContext(context, supabase);
      return helpText;
    }

    // Inicializar OpenAI
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

    let continueLoop = true;
    let finalResponse = "";
    let iterationCount = 0;
    const MAX_ITERATIONS = 8;
    
    const toolCallTracker = new Map<string, number>();

    const historyLimit = context.order_state === "idle" ? 1 
      : context.order_state === "browsing" ? 2 : 6;
    
    const menuPattern = /\d+\.\s+\*?.+\$[\d.,]+/;
    const filteredHistory = context.conversation_history
      .slice(-historyLimit)
      .filter(msg => {
        if (msg.role === "user") return true;
        if (msg.role === "assistant" && msg.content && menuPattern.test(msg.content)) return false;
        return true;
      });
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...filteredHistory,
    ];

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`🔁 Iteration ${iterationCount}/${MAX_ITERATIONS}, state: ${context.order_state || "idle"}`);

      messages[0] = { role: "system", content: buildSystemPrompt(context) };

      const nonCheckoutStates = ["idle", "browsing", "shopping", "needs_address"];
      const forceTools = nonCheckoutStates.includes(context.order_state || "idle") 
        && iterationCount === 1
        && !context.resumen_mostrado;

      const currentState = context.order_state || "idle";
      const filteredTools = filterToolsByState(currentState, context);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: filteredTools,
        temperature: 0,
        max_tokens: 800,
        tool_choice: forceTools ? "required" : "auto",
      });

      const assistantMessage = completion.choices[0].message;

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          const callCount = toolCallTracker.get(toolName) || 0;
          const maxCalls = toolName === 'ver_menu_negocio' ? 1 : 2;
          
          if (callCount >= maxCalls) {
            if (toolName === 'ver_menu_negocio') {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: t('menu.one_at_a_time', lang),
              });
              continue;
            }
            continueLoop = false;
            finalResponse = t('error.reformulate', lang);
            break;
          }
          toolCallTracker.set(toolName, callCount + 1);

          const toolResult = await ejecutarHerramienta(toolName, toolArgs, context, supabase);

          if (DIRECT_RESPONSE_TOOLS.has(toolName) && assistantMessage.tool_calls!.length === 1) {
            finalResponse = toolResult;
            continueLoop = false;
            await saveContext(context, supabase);
            break;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        
        if (!continueLoop) break;

        await saveContext(context, supabase);
        continue;
      }

      // 🛡️ Si estamos en shopping y el LLM responde texto libre sin herramientas,
      // dar una respuesta breve con opciones concretas en vez de dejar que el LLM divague
      if (context.order_state === "shopping" && context.selected_vendor_id) {
        finalResponse = t('shopping.not_understood', lang);
      } else {
        finalResponse = assistantMessage.content || t('error.not_understood', lang);
      }
      continueLoop = false;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      finalResponse = t('error.max_iterations', lang);
    }

    context.conversation_history.push({ role: "assistant", content: finalResponse });
    await saveContext(context, supabase);

    console.log("🤖 AI Bot END");
    return finalResponse;
  } catch (error) {
    console.error("❌ AI Bot ERROR:", error);
    
    const errorMessage = error.message || 'Unknown error';
    const isOpenAIError = errorMessage.includes('OpenAI') || 
                          errorMessage.includes('rate limit') || 
                          errorMessage.includes('API') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('insufficient_quota') ||
                          error.name === 'APIError';
    
    if (isOpenAIError) {
      await logBotError(supabase, 'OPENAI_ERROR', errorMessage, normalizedPhone, undefined, { name: error.name, stack: error.stack?.substring(0, 500) });
      const emergencyActivated = await incrementErrorCount(supabase, errorMessage);
      
      if (emergencyActivated) {
        const updatedSettings = await checkPlatformSettings(supabase);
        if (updatedSettings) {
          return await handleEmergencyFallback(updatedSettings, normalizedPhone, message, supabase);
        }
      }
    } else {
      await logBotError(supabase, 'BOT_ERROR', errorMessage, normalizedPhone, undefined, { name: error.name });
    }
    
    return t('error.generic', 'es');
  }
}
