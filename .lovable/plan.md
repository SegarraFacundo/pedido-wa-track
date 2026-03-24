

# Plan: Fix checkout flow — payment selection and confirmation

## Problems identified

1. **"1" in checkout captured by shopping interceptor**: When payment methods are shown and user types "1", the shopping interceptor (line 3916) fires first because `order_state` is still `"shopping"` — it adds product #1 to cart instead of selecting "Efectivo".

2. **State not transitioning to checkout**: When the confirmation interceptor shows payment methods (line 4159-4162), it never sets `order_state = "checkout"`. So subsequent messages still match `order_state === "shopping"`.

3. **After payment selection, "Listo" loops**: The payment interceptor (line 4204) selects the method and calls `crear_pedido`, but `crear_pedido` checks `resumen_mostrado` (line 1519) and shows the summary instead. Then "Listo" hits the confirmation interceptor which calls `crear_pedido` again... which shows the summary again because `resumen_mostrado` was reset.

## Changes in `vendor-bot.ts`

### 1. Move payment method interceptor BEFORE shopping interceptor
The block at lines 4195-4297 (payment_methods_fetched check + selection) must run **before** the shopping interceptor at line 3916. This way "1" in checkout goes to payment selection, not product addition.

### 2. Set `order_state = "checkout"` when showing payment methods from confirmation
In the confirmation interceptor block (lines 4128-4171), when showing payment methods:
- Line 4159-4162: add `context.order_state = "checkout"` before showing payment methods
- Line 4148: when auto-setting delivery to `needs_address`, already done correctly
- Line 4151: when auto-setting pickup to `checkout`, already done correctly
- But the `else` branch (line 4155, both delivery options) should also set a transitional state

### 3. Set `order_state = "checkout"` when `confirmar_direccion_entrega` shows payment methods
In `confirmar_direccion_entrega` (line 2730), after saving address, if it shows payment methods, set `context.order_state = "checkout"`.

### 4. Fix payment selection flow: show summary after selecting payment
When the payment interceptor selects a method (line 4260-4297), instead of calling `crear_pedido` directly, call `mostrar_resumen_pedido` first. This shows the summary and sets `resumen_mostrado = true`. Then when user says "Listo"/"Sí", the `resumen_mostrado` interceptor (line 3932) catches it and calls `crear_pedido`.

### 5. Guard shopping interceptor: skip when payment_methods_fetched and no payment_method
Add a condition to the shopping interceptor gate (line 3916): if `payment_methods_fetched === true` and `payment_method` is not set, skip the shopping interceptor for numeric inputs — they're payment selections, not product selections.

## Summary of interceptor order (after changes)

```text
1. awaiting_delivery_mode_confirmation → sí/no
2. payment_methods_fetched + no payment_method → numeric/text selection
3. shopping + purchase intent → add to cart
4. resumen_mostrado → sí = crear_pedido
5. confirmation signal (shopping/checkout) → show cart + next step
6. needs_address → capture address
7. idle/browsing interceptors
8. LLM fallback
```

## Expected flow after fix

```text
User: "Listo" (in shopping)
→ confirmation interceptor shows cart + auto-selects delivery + asks address
→ state = needs_address

User: "Av. Villada 1508"
→ address interceptor saves address + shows payment methods
→ state = checkout

User: "1"
→ payment interceptor selects "efectivo" → shows summary
→ resumen_mostrado = true

User: "Sí"
→ resumen_mostrado interceptor → crear_pedido
→ Order created ✅
```

## Files to modify

| File | Change |
|------|--------|
| `vendor-bot.ts` | Reorder interceptors; set checkout state when showing payments; show summary after payment selection instead of creating order directly |

