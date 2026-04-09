

# Plan: Corregir 2 bugs en el flujo de compra del bot

## Problema 1 — El usuario pide productos pero el bot muestra el menú de nuevo
Cuando el usuario dice "quiero helado de chocolate, frutilla y vainilla" desde el estado `browsing` con un solo vendor en `available_vendors_map`, el shopping interceptor devuelve `null` porque no hay `selected_vendor_id` todavía. El mensaje cae al LLM que muestra el menú en vez de agregar los productos al carrito.

**Fix**: Antes de llamar al shopping interceptor, si el estado es `browsing`, hay 1 solo vendor en `available_vendors_map`, y el mensaje tiene intención de compra (PURCHASE_VERB_REGEX o similares), auto-seleccionar ese vendor (seteando `selected_vendor_id` y `selected_vendor_name`) y luego ejecutar `ver_menu_negocio` + shopping interceptor.

## Problema 2 — "Confirmo el pedido" se interpreta como dirección
Cuando el bot muestra el carrito + pide dirección en un mismo mensaje (delivery-only), el usuario responde "Confirmo el pedido realizado previamente" y el interceptor de `needs_address` lo trata como una dirección. El estado ya está en `needs_address` y cualquier texto >3 chars que no empiece con "cancel/volver/no/etc" se acepta como dirección.

**Fix**: Separar el flujo para que al confirmar el carrito, el bot primero muestre un mensaje de "carrito confirmado" y **espere** la dirección en un segundo mensaje. Además, agregar "confirm" al regex `notAddress` para que frases de confirmación no se interpreten como dirección.

## Cambios

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` ~4524-4528 | Agregar `confirm` y `pedido` al regex `notAddress` para que "confirmo el pedido..." no se trate como dirección |
| `vendor-bot.ts` ~4369-4372 | Separar: cuando delivery-only, solo setear `needs_address` y pedir dirección. No mezclar con confirmación de carrito |
| `vendor-bot.ts` ~4544 area | Antes del interceptor de browsing, si hay 1 vendor en map + intención de compra, auto-seleccionar vendor y delegar al shopping interceptor |

## Detalle técnico

### Fix 1 — notAddress regex (línea 4528)
```typescript
const notAddress = /^(cancel|volver|cambiar|no|menu|carrito|ayuda|estado|hola|confirm|pedido|listo|dale|si\b|sí\b)/i.test(msgLower);
```

### Fix 2 — Auto-selección de vendor en browsing con intención de compra
Antes del interceptor de browsing (línea ~4543), agregar:
```typescript
if ((context.order_state === "browsing" || context.order_state === "idle") 
    && !context.selected_vendor_id 
    && context.available_vendors_map?.length === 1
    && looksLikePurchaseIntent(message)) {
  const singleVendor = context.available_vendors_map[0];
  // Auto-select vendor and show menu + process shopping
  await ejecutarHerramienta("ver_menu_negocio", { vendor_id: String(singleVendor.index) }, context, supabase);
  const shoppingResult = await handleShoppingInterceptor(message, context, supabase);
  if (shoppingResult) {
    context.conversation_history.push({ role: "assistant", content: shoppingResult });
    await saveContext(context, supabase);
    return shoppingResult;
  }
}
```

## Resultado
1. "Quiero helado de chocolate, frutilla y vainilla" después de búsqueda con 1 vendor → agrega al carrito directamente
2. "Confirmo el pedido" cuando pide dirección → no se toma como dirección, se reconoce como confirmación

