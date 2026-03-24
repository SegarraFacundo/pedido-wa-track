

# Plan: Show full cart contents when adding products

## Problem
When products are added to the cart, the bot only shows the total — not what's in the cart. The user wants to see the itemized list every time.

## Change

In `vendor-bot.ts` line 1196, replace the single-line response with one that lists all cart items before the total:

```typescript
// Build itemized cart list
const cartList = context.cart.map((item, i) => 
  `${i + 1}. ${item.product_name} x${item.quantity} — $${Math.round(item.price * item.quantity)}`
).join('\n');

return `✅ Productos agregados al carrito de *${context.selected_vendor_name}*.\n\n` +
  `🛒 *Tu carrito:*\n${cartList}\n\n` +
  `💰 *Total: $${Math.round(total)}*\n\n` +
  `¿Querés agregar algo más o confirmás el pedido? 📦`;
```

## File
| File | Change |
|------|--------|
| `vendor-bot.ts` (line 1196) | Replace total-only message with itemized cart + total |

