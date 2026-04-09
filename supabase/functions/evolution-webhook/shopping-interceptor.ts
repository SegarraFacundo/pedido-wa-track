import type { ConversationContext } from "./types.ts";
import { saveContext } from "./context.ts";
import { ejecutarHerramienta } from "./tool-executors.ts";
import { normalizeIntentText, isOrderConfirmationSignal, looksLikePurchaseIntent } from "./vendor-bot.ts";

export async function handleShoppingInterceptor(
  message: string,
  context: ConversationContext,
  supabase: any
): Promise<string | null> {
  const text = message.trim();
  const textLower = text.toLowerCase();
  const vendorId = context.selected_vendor_id;
  if (!vendorId) return null;

  // Evitar interpretar saludos como productos (ej: "hola")
  const isGreetingOnly = /^(hola|holi|buenas?|buen\s*d[ií]a|buen[oa]s?\s+(d[ií]as|tardes|noches)|hey)$/i.test(text);
  if (isGreetingOnly) {
    const cartSummary = context.cart.length > 0
      ? `Tenés ${context.cart.length} producto${context.cart.length === 1 ? '' : 's'} en el carrito.`
      : "Todavía no agregaste productos al carrito.";

    return `${cartSummary}\n¿Querés que te muestre el menú de ${context.selected_vendor_name || "este negocio"} o preferís ver otros locales?`;
  }

  // Evitar tratar comandos de flujo/confirmaciones como nombre de producto
  // CRÍTICO: "carrito" siempre es un comando, incluso con "quiero ver el carrito"
  const wantsCartView = /\bcarrito\b/i.test(textLower);
  if (wantsCartView) return null;

  const normalizedIntent = normalizeIntentText(text);
  const wantsFlowCommand = /^(?:confirma(?:r|do|mos)?(?:\s+pedido)?|(?:lo\s+)?confirm(?:o|ado|ar|amos)?|listo|finalizar|terminar(?:\s+pedido)?|pagar|vaciar\s+carrito|ver\s+menu|menu|eso\s+(?:es\s+)?todo|ya\s+esta|nada\s+mas)$/.test(normalizedIntent);
  const looksLikeConfirmation = isOrderConfirmationSignal(text);

  if ((wantsFlowCommand || looksLikeConfirmation) && !looksLikePurchaseIntent(text)) {
    return null;
  }

  // 🔍 Pre-process: extract multi-intent parts
  let productPart = text;
  let addressPart: string | null = null;
  let paymentPart: string | null = null;

  // Extract address
  const addressMatch = text.match(/(?:enviam?elo?\s+a|enviar\s+a|direcci[oó]n\s+|a\s+la\s+direcci[oó]n\s+)([\w\s.,]+?)(?:\s+y\s+pago|\s+pago\s+|$)/i);
  if (addressMatch) {
    addressPart = addressMatch[1].trim();
    productPart = text.substring(0, text.indexOf(addressMatch[0])).trim();
  }

  // Extract payment
  const paymentMatch = text.match(/pago\s+(?:en\s+|con\s+)?(efectivo|transferencia|mercadopago|mp)/i);
  if (paymentMatch) {
    paymentPart = paymentMatch[1].trim();
    if (!addressPart) {
      productPart = text.substring(0, text.indexOf(paymentMatch[0])).trim();
    }
  }

  productPart = productPart.replace(/\s+y\s*$/i, '').replace(/\s+quiero\s*$/i, '').trim();

  console.log(`🛒 SHOPPING INTERCEPTOR: productPart="${productPart}", addressPart="${addressPart}", paymentPart="${paymentPart}"`);

  // ==================== MULTI-PRODUCT PARSING ====================
  // Split by " y " or "," to handle "1 helado de chocolate y 1 helado de vainilla"
  const productSegments = splitProductSegments(productPart);
  console.log(`🛒 MULTI-PRODUCT: ${productSegments.length} segment(s): ${JSON.stringify(productSegments)}`);

  // Fetch products from DB once
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, is_available, stock_enabled, stock_quantity")
    .eq("vendor_id", vendorId)
    .eq("is_available", true)
;

  if (error) {
    console.error("❌ Shopping interceptor: Error fetching products:", error);
    return null;
  }
  if (!products || products.length === 0) {
    console.warn("⚠️ Shopping interceptor: No products found for vendor", vendorId);
    return `⚠️ *${context.selected_vendor_name}* no tiene productos disponibles en este momento.\n\n¿Querés ver otros negocios? Escribí "ver negocios" 😊`;
  }

  // Parse each segment into { quantity, searchTerm, menuIndex }
  const parsedItems: { quantity: number; searchTerm: string | null; menuIndex: number | null }[] = [];
  
  for (const segment of productSegments) {
    const parsed = parseProductSegment(segment.trim());
    if (parsed) {
      parsedItems.push(parsed);
    }
  }

  if (parsedItems.length === 0) return null;

  // Resolve each parsed item to a product
  const itemsToAdd: { product_id: string; product_name: string; quantity: number; price: number }[] = [];
  const errors: string[] = [];

  for (const item of parsedItems) {
    let matchedProduct: any = null;

    if (item.menuIndex !== null) {
      if (item.menuIndex >= 1 && item.menuIndex <= products.length) {
        matchedProduct = products[item.menuIndex - 1];
        console.log(`✅ Product resolved by menu index #${item.menuIndex}: ${matchedProduct.name}`);
      } else {
        errors.push(`⚠️ No existe el producto #${item.menuIndex}. El menú tiene ${products.length} productos.`);
        continue;
      }
    } else if (item.searchTerm) {
      matchedProduct = findProductByName(item.searchTerm, products);
      if (!matchedProduct) {
        errors.push(`No encontré "${item.searchTerm}" en el menú.`);
        continue;
      }
      console.log(`✅ Product resolved by name "${item.searchTerm}": ${matchedProduct.name}`);
    }

    if (matchedProduct) {
      itemsToAdd.push({
        product_id: matchedProduct.id,
        product_name: matchedProduct.name,
        quantity: item.quantity,
        price: matchedProduct.price,
      });
    }
  }

  if (itemsToAdd.length === 0 && errors.length > 0) {
    return errors.join('\n') + `\n\nProductos disponibles:\n${products.map((p: any, i: number) => `${i + 1}. ${p.name} - $${p.price}`).join('\n')}\n\nDecime el número o nombre del producto.`;
  }

  if (itemsToAdd.length === 0) return null;

  // Add all items to cart
  const result = await ejecutarHerramienta("agregar_al_carrito", {
    items: itemsToAdd,
  }, context, supabase);

  let multiResult = result;
  
  // Append any partial errors
  if (errors.length > 0) {
    multiResult += `\n\n⚠️ ${errors.join('\n')}`;
  }

  // Multi-intent: address
  if (addressPart && addressPart.length > 3) {
    console.log(`📍 MULTI-INTENT: Processing address "${addressPart}"`);
    context.delivery_type = "delivery";
    const addressResult = await ejecutarHerramienta("confirmar_direccion_entrega", {
      direccion: addressPart,
    }, context, supabase);
    multiResult += `\n\n${addressResult}`;
  }

  // Multi-intent: payment
  if (paymentPart) {
    console.log(`💳 MULTI-INTENT: Setting payment method "${paymentPart}"`);
    const methodMap: Record<string, string> = {
      'efectivo': 'efectivo', 'transferencia': 'transferencia',
      'mercadopago': 'mercadopago', 'mp': 'mercadopago',
    };
    const mapped = methodMap[paymentPart.toLowerCase()];
    if (mapped) {
      context.payment_method = mapped;
      await saveContext(context, supabase);
    }
  }

  return multiResult;
}

// ==================== HELPER: Split product segments ====================
function isClarificationOnlySegment(segment: string): boolean {
  const normalized = segment
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?]/g, "")
    .trim();

  // Filter out conversational noise: "genial", "por ultimo", "una", "y listo", etc.
  return /^(?:no\s+solo\s+(?:uno|una|1)|(?:solo|solamente)\s+(?:uno|una|1)|no\s+(?:uno|una|1)|nada\s+mas|eso(?:\s+solo)?|nomas|genial|perfecto|buenisimo|excelente|dale|ok(?:ay)?|bien|por\s+(?:ultimo|favor)|y\s+(?:listo|ya|nada\s+mas)|una|uno|eso)$/.test(normalized);
}

export function splitProductSegments(text: string): string[] {
  // Handle "1 helado de chocolate y 1 helado de vainilla" or "pizza, coca"
  // But don't split on "y" inside product names like "sal y pimienta"
  // Strategy: split on " y " only if what follows looks like a product request (number or verb prefix)
  
  const parts: string[] = [];
  // Split by comma first
  const commaParts = text.split(/,\s*/);
  
  for (const commaPart of commaParts) {
    // Now split by " y " only when followed by a number or verb prefix
    const yParts = commaPart.split(/\s+y\s+(?=\d|un[ao]?\s|quiero|quer(?:ia|ía)|quisiera|dame|poneme|agregame|mandame|traeme|trae|traer|necesito)/i);
    parts.push(...yParts);
  }
  
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((segment) => {
      const isClarification = isClarificationOnlySegment(segment);
      if (isClarification) {
        console.log(`🧹 MULTI-PRODUCT: Ignoring clarification segment "${segment}"`);
      }
      return !isClarification;
    });
}

// ==================== HELPER: Spanish number words to integer ====================
export function spanishNumberToInt(word: string): number | null {
  const map: Record<string, number> = {
    'un': 1, 'una': 1, 'uno': 1,
    'dos': 2,
    'tres': 3,
    'cuatro': 4,
    'cinco': 5,
    'seis': 6,
    'siete': 7,
    'ocho': 8,
    'nueve': 9,
    'diez': 10,
    'once': 11,
    'doce': 12,
    'media': 6, // "media docena"
    'docena': 12,
    'quince': 15,
    'veinte': 20,
  };
  return map[word.toLowerCase()] ?? null;
}

// ==================== HELPER: Parse a single product segment ====================
export function parseProductSegment(segment: string): { quantity: number; searchTerm: string | null; menuIndex: number | null } | null {
  const cleanSegment = segment
    .trim()
    .replace(/^[,.;:!?]+|[,.;:!?]+$/g, "")
    .replace(/^(?:bueno|ok(?:ay)?|dale|che|genial|perfecto|por\s+(?:ultimo|favor))\s*/i, "")
    .replace(/^(?:y\s+)?(?:por\s+ultimo|tambien|ademas)\s+/i, "")
    .trim();

  if (!cleanSegment) return null;
  if (isClarificationOnlySegment(cleanSegment)) return null;

  const normalizedSegment = normalizeIntentText(cleanSegment);
  const commandOnlySegment = (/^(?:ver|mostrar|mirar|revisar|confirma(?:r|do|mos)?|(?:lo\s+)?confirm(?:o|ado|ar|amos)?|finalizar|terminar|pagar|vaciar|listo|ya\s+esta)$/.test(normalizedSegment)
    || isOrderConfirmationSignal(cleanSegment))
    && !looksLikePurchaseIntent(cleanSegment);
  if (commandOnlySegment) return null;

  // Solo número → menu index
  const soloNumero = cleanSegment.match(/^(\d+)$/);
  if (soloNumero) {
    return { quantity: 1, searchTerm: null, menuIndex: parseInt(soloNumero[1]) };
  }

  // "N producto" ("2 remeras", "1 helado de chocolate")
  const cantidadProducto = cleanSegment.match(/^(\d+)\s+(.+)/i);
  if (cantidadProducto) {
    const qty = parseInt(cantidadProducto[1]);
    if (qty >= 1 && qty <= 50) {
      return { quantity: qty, searchTerm: cantidadProducto[2].trim(), menuIndex: null };
    }
  }

  // "media docena de X" → 6
  const mediaDocena = cleanSegment.match(/^media\s+docena\s+(?:de\s+)?(.+)/i);
  if (mediaDocena) {
    return { quantity: 6, searchTerm: mediaDocena[1].trim(), menuIndex: null };
  }

  // "una docena de X" → 12
  const docena = cleanSegment.match(/^(?:una?\s+)?docena\s+(?:de\s+)?(.+)/i);
  if (docena) {
    return { quantity: 12, searchTerm: docena[1].trim(), menuIndex: null };
  }

  // "una/uno producto"
  const unaPattern = cleanSegment.match(/^(?:una?|uno)\s+(.+)/i);
  if (unaPattern) {
    return { quantity: 1, searchTerm: unaPattern[1].trim(), menuIndex: null };
  }

  // "quiero/quería/traer N producto" (digit)
  const verbWithDigitQty = cleanSegment.match(/^(?:quiero|quer(?:ia|ía)|quisiera|dame|deme|poneme|agregame|mandame|traeme|trae|traer|necesito|llevo)\s+(?:(?:los|las|unos?|unas?)\s+)?(\d+)\s+(.+)/i);
  if (verbWithDigitQty) {
    const qty = parseInt(verbWithDigitQty[1]);
    if (qty >= 1 && qty <= 50) {
      return { quantity: qty, searchTerm: verbWithDigitQty[2].trim(), menuIndex: null };
    }
  }

  // "quiero/quería/traer SPANISH_NUMBER producto" ("dame cuatro tiramisú", "traeme dos empanadas")
  const verbWithWordQty = cleanSegment.match(/^(?:quiero|quer(?:ia|ía)|quisiera|dame|deme|poneme|agregame|mandame|traeme|trae|traer|necesito|llevo)\s+(?:(?:los|las|unos?|unas?)\s+)?(\w+)\s+(.+)/i);
  if (verbWithWordQty) {
    const qty = spanishNumberToInt(verbWithWordQty[1]);
    if (qty !== null && qty >= 1 && qty <= 50) {
      return { quantity: qty, searchTerm: verbWithWordQty[2].trim(), menuIndex: null };
    }
  }

  // "quiero/quería/traer producto" (qty 1)
  const verbSimple = cleanSegment.match(/^(?:quiero|quer(?:ia|ía)|quisiera|dame|deme|poneme|agregame|mandame|traeme|trae|traer|necesito|llevo)\s+(.+)/i);
  if (verbSimple) {
    return { quantity: 1, searchTerm: verbSimple[1].trim(), menuIndex: null };
  }

  // "SPANISH_NUMBER producto" sin verbo ("cuatro tiramisú", "dos cocas")
  const spanishNumProduct = cleanSegment.match(/^(\w+)\s+(.+)/i);
  if (spanishNumProduct) {
    const qty = spanishNumberToInt(spanishNumProduct[1]);
    if (qty !== null && qty >= 1 && qty <= 50) {
      return { quantity: qty, searchTerm: spanishNumProduct[2].trim(), menuIndex: null };
    }
  }

  // Just a product name (e.g. "helado de vainilla")
  if (cleanSegment.length > 2 && !/^\d+$/.test(cleanSegment)) {
    return { quantity: 1, searchTerm: cleanSegment, menuIndex: null };
  }

  return null;
}

// ==================== HELPER: Find product by name ====================
export function findProductByName(searchTerm: string, products: any[]): any {
  // Normalize accents for comparison
  const normalize = (s: string) => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/s$/, '');
  
  const searchNorm = normalize(searchTerm);
  
  let matched = products.find((p: any) => {
    const nameNorm = normalize(p.name);
    return nameNorm.includes(searchNorm) || searchNorm.includes(nameNorm);
  });

  if (!matched) {
    const words = searchNorm.split(/\s+/);
    matched = products.find((p: any) => {
      const nameNorm = normalize(p.name);
      return words.some((w: string) => w.length > 2 && nameNorm.includes(w));
    });
  }

  return matched;
}

