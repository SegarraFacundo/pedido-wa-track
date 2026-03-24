

# Plan: Fix checkout confirmation loop

## Problem
When the user reaches checkout and says "Sí" or "Listo":
1. The confirmation interceptor (line 4022) only handles `order_state === 'shopping'` — checkout state falls through
2. The payment selection interceptor (line 4151) requires `payment_methods_fetched === true`, but the LLM may show payment info without calling `ver_metodos_pago` (which sets that flag)
3. Result: the message falls to the LLM, which loops showing the cart and payment methods again

## Changes in `vendor-bot.ts`

### 1. Extend confirmation interceptor to handle `checkout` state
Add `checkout` to the state check at line 4022. When confirming in checkout:
- If `payment_method` is already set → create order directly
- If only 1 payment method available → auto-select it and create order
- If no payment method → show payment methods via `ver_metodos_pago`

### 2. Add fallback: set `payment_methods_fetched` when checkout state has available methods
Before the LLM call, if `order_state === 'checkout'` and `available_payment_methods` is empty but `selected_vendor_id` exists, auto-fetch payment methods and set the flag. This ensures the payment interceptor at line 4151 fires on subsequent messages.

## File to modify

| File | Change |
|------|--------|
| `vendor-bot.ts` | Line 4022: expand to `shopping` or `checkout`; add auto-select logic for single payment method in checkout |

## Expected result
- "Sí" in checkout with 1 method → auto-selects efectivo → creates order
- "Listo" in checkout → same
- No more cart/payment loop

