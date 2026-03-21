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

  return `You are an intent classifier for a WhatsApp food delivery bot. 
Current state: ${state}
${contextHints.length > 0 ? contextHints.join('. ') + '.' : ''}

Classify the user message into ONE intent from this list:
${INTENT_LIST}

Return ONLY valid JSON: {"intent": "...", "params": {...}, "confidence": 0.0-1.0}

Intent guide:
- browse_stores: wants to see available stores/shops
- search_product: looking for a specific food/product (params: {query: "..."})
- select_vendor: choosing a store by number or name (params: {vendor_ref: "..."})
- view_menu: wants to see current store's menu
- add_to_cart: adding product(s) (params: {product_ref: "...", quantity: N})
- remove_from_cart: removing a product from cart
- view_cart: wants to see what's in their cart
- empty_cart: wants to clear/empty the cart
- confirm_order: confirming, saying "yes/done/listo/dale/confirmo"
- select_delivery: choosing delivery or pickup (params: {type: "delivery"|"pickup"})
- give_address: providing delivery address (params: {address: "..."})
- select_payment: choosing payment method (params: {method: "..."})
- check_status: checking order status
- cancel_order: wants to cancel
- rate_order: wants to rate their order
- rate_platform: wants to rate the platform
- talk_to_human: wants to talk to vendor/support
- view_schedule: wants to see store hours
- view_offers: wants to see deals/offers
- help: asking for help/menu
- reset: restart/clear everything
- change_language: wants to switch language (params: {lang: "es"|"en"|"pt"|"ja"})
- greeting: saying hello, hi, good morning/afternoon/evening, or general greeting
- unknown: can't determine intent

IMPORTANT: In state "browsing", numbers likely mean selecting a vendor. In state "shopping", numbers mean adding a product from the menu.
In state "needs_address", most text is an address (give_address) unless it's a command.
In state "checkout" or when payment methods were shown, numbers/text likely select a payment method.`;
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
      // Try to extract first JSON object from text (AI may have added text around it)
      const braceMatch = content.match(/\{[\s\S]*\}/);
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
