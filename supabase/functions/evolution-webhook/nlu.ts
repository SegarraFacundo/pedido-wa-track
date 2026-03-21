// ==================== NLU: Natural Language Understanding ====================
// Classifies user messages into intents using minimal AI call.
// The AI NEVER generates user-facing text — only returns JSON.

import { ConversationContext } from "./types.ts";

export type Intent =
  | "browse_stores"
  | "search_product"
  | "select_vendor"
  | "view_menu"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "empty_cart"
  | "confirm_order"
  | "select_delivery"
  | "give_address"
  | "select_payment"
  | "check_status"
  | "cancel_order"
  | "rate_order"
  | "rate_platform"
  | "talk_to_human"
  | "view_schedule"
  | "view_offers"
  | "help"
  | "reset"
  | "change_language"
  | "greeting"
  | "unknown";

export interface NLUResult {
  intent: Intent;
  params: Record<string, any>;
  confidence: number;
}

const INTENT_LIST = `browse_stores, search_product, select_vendor, view_menu, add_to_cart, remove_from_cart, view_cart, empty_cart, confirm_order, select_delivery, give_address, select_payment, check_status, cancel_order, rate_order, rate_platform, talk_to_human, view_schedule, view_offers, help, reset, change_language, greeting, unknown`;

function buildNLUPrompt(state: string, context: ConversationContext): string {
  const contextHints: string[] = [];
  if (context.selected_vendor_name) contextHints.push(`Current vendor: ${context.selected_vendor_name}`);
  if (context.cart.length > 0) contextHints.push(`Cart has ${context.cart.length} items`);
  if (context.available_vendors_map?.length) contextHints.push(`Vendor list shown with ${context.available_vendors_map.length} options`);
  if (context.delivery_type) contextHints.push(`Delivery type: ${context.delivery_type}`);
  if (context.payment_method) contextHints.push(`Payment: ${context.payment_method}`);

  return `Eres un parser de intención para "Lapacho Delivery".
Tu única tarea es:
1. Identificar la intención del usuario
2. Extraer entidades relevantes

NO eres un asistente conversacional.
NO debes responder al usuario.
NO debes tomar decisiones.
NO debes inventar información.

Estado actual: ${state}
${contextHints.length > 0 ? contextHints.join('. ') + '.' : ''}

FORMATO OBLIGATORIO (SIEMPRE JSON VÁLIDO):
{"intent": "string", "params": {}, "confidence": 0.0}

REGLAS ESTRICTAS:
1. SOLO puedes responder JSON válido.
2. NO incluyas texto fuera del JSON.
3. NO agregues explicaciones.
4. NO uses markdown.
5. Si no estás seguro → usa "unknown".
6. Si el mensaje es ambiguo → usa "unknown".
7. Si faltan datos clave → usa "unknown".

CONFIDENCE (OBLIGATORIO):
- 0.9 → intención muy clara
- 0.7 → bastante clara
- 0.5 → dudosa
- <0.3 → muy incierta → usar "unknown"

NORMALIZACIÓN DE PARAMS:
- product_ref → string simple (ej: "pizza", "hamburguesa")
- quantity → número entero
- vendor_ref → nombre o número de la lista
- address → texto de dirección
- method → método de pago
- type → "delivery" o "pickup"
- lang → "es", "en", "pt", "ja"
- query → texto de búsqueda

INTENTS PERMITIDOS (WHITELIST):
browse_stores, search_product, select_vendor, view_menu, add_to_cart, remove_from_cart, view_cart, empty_cart, confirm_order, select_delivery, give_address, select_payment, check_status, cancel_order, rate_order, rate_platform, talk_to_human, view_schedule, view_offers, help, reset, change_language, greeting, unknown

Si detectas algo fuera de esta lista → usar "unknown".

NUNCA:
- inventar productos
- inventar precios
- asumir restaurante
- completar pedidos
- inferir datos faltantes

REGLA CRÍTICA - UN SOLO JSON:
- SIEMPRE devuelve UN SOLO objeto JSON, nunca dos.
- Si el usuario pide varios productos (ej: "dame 4 tiramisú y una coca"), usa add_to_cart con el PRIMER producto mencionado.
  Ejemplo: {"intent": "add_to_cart", "params": {"product_ref": "tiramisú", "quantity": 4}, "confidence": 0.9}
  El sistema procesará los demás productos en turnos siguientes.

CASOS ESPECIALES POR ESTADO:
- En estado "browsing": números probablemente seleccionan un vendor → select_vendor con params {vendor_ref: "N"}
- En estado "shopping": números probablemente agregan un producto del menú → add_to_cart con params {product_ref: "N", quantity: 1}
- En estado "shopping": "quitar/sacar/eliminar/borrar + producto/número" → remove_from_cart con params {product_ref: "..."}
  Ejemplos: "quitar pizza" → {"intent": "remove_from_cart", "params": {"product_ref": "pizza"}, "confidence": 0.9}
  "sacar el 2" → {"intent": "remove_from_cart", "params": {"product_ref": "2"}, "confidence": 0.9}
  "eliminar tiramisú" → {"intent": "remove_from_cart", "params": {"product_ref": "tiramisú"}, "confidence": 0.9}
- En estado "needs_address": la mayoría del texto es una dirección → give_address con params {address: "..."}
- En estado "checkout": números/texto seleccionan método de pago → select_payment con params {method: "..."}

EJEMPLOS:

Usuario: "hola"
{"intent": "greeting", "params": {}, "confidence": 0.95}

Usuario: "quiero pizza"
{"intent": "search_product", "params": {"query": "pizza"}, "confidence": 0.9}

Usuario: "agregar 2 hamburguesas"
{"intent": "add_to_cart", "params": {"product_ref": "hamburguesa", "quantity": 2}, "confidence": 0.95}

Usuario: "lo mismo de siempre"
{"intent": "unknown", "params": {}, "confidence": 0.2}

Usuario: "..."
{"intent": "unknown", "params": {}, "confidence": 0.1}

REGLA FINAL:
Es mejor devolver "unknown" que equivocarse. Nunca adivines. Nunca completes información faltante.`;
}

export async function classifyIntent(
  message: string,
  context: ConversationContext,
): Promise<NLUResult> {
  const state = context.order_state || "idle";

  try {
    // Use LOVABLE_API_KEY if available, fallback to OPENAI_API_KEY
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (lovableKey) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = lovableKey;
      model = "google/gemini-2.5-flash-lite";
    } else if (openaiKey) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = openaiKey;
      model = "gpt-4o-mini";
    } else {
      console.error("❌ NLU: No API key available");
      return { intent: "unknown", params: {}, confidence: 0 };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildNLUPrompt(state, context) },
          { role: "user", content: message },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error(`❌ NLU API error: ${response.status}`);
      return { intent: "unknown", params: {}, confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.warn("⚠️ NLU: Empty response from AI");
      return { intent: "unknown", params: {}, confidence: 0 };
    }

    // Extract JSON from response (handle markdown code blocks, text around JSON, etc.)
    let jsonStr = content;
    
    // Try markdown code block first
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to extract first JSON object (non-greedy to avoid grabbing multiple objects)
      const braceMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      } else {
        console.warn("⚠️ NLU: No JSON found in response:", content.substring(0, 200));
        return { intent: "unknown", params: {}, confidence: 0 };
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn("⚠️ NLU: Invalid JSON from AI:", jsonStr.substring(0, 200));
      return { intent: "unknown", params: {}, confidence: 0 };
    }

    // Strict validation: must have intent as string and params as object
    if (!parsed || typeof parsed.intent !== "string" || typeof parsed.params !== "object") {
      console.warn("⚠️ NLU: Invalid structure from AI:", JSON.stringify(parsed).substring(0, 200));
      return { intent: "unknown", params: {}, confidence: 0 };
    }

    // Validate intent is in allowed list
    const validIntents: Intent[] = [
      "browse_stores", "search_product", "select_vendor", "view_menu",
      "add_to_cart", "remove_from_cart", "view_cart", "empty_cart",
      "confirm_order", "select_delivery", "give_address", "select_payment",
      "check_status", "cancel_order", "rate_order", "rate_platform",
      "talk_to_human", "view_schedule", "view_offers", "help", "reset",
      "change_language", "greeting", "unknown",
    ];

    const intent: Intent = validIntents.includes(parsed.intent) ? parsed.intent : "unknown";
    const params = parsed.params || {};
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

    // Confidence threshold: too low = unknown
    if (confidence < 0.3) {
      console.warn(`⚠️ NLU: Low confidence ${confidence} for intent "${intent}", treating as unknown`);
      return { intent: "unknown", params, confidence };
    }

    console.log(`🧠 NLU: "${message}" → ${intent} (${confidence}) params:`, JSON.stringify(params));
    return { intent, params, confidence };
  } catch (error) {
    console.error("❌ NLU classification error:", error);
    return { intent: "unknown", params: {}, confidence: 0 };
  }
}
