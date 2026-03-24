

# Plan: Invertir el flujo — LLM primero, interceptores como fallback

## Problema actual
En estado `shopping`, **todo mensaje** pasa por `handleShoppingInterceptor` (línea 3864) que intenta parsearlo como producto. Si no matchea con confirmación/comando (regex limitado), lo trata como búsqueda de producto y devuelve "No encontré X en el menú". El LLM nunca ve el mensaje.

Lo mismo ocurre en `idle/browsing`: hay una cadena de interceptores (vendor list, vendor name match, purchase intent, explicit search) que capturan casi todo antes del LLM.

## Solución
Reducir el interceptor de shopping a **solo números y frases con intención de compra clara**, y dejar que todo lo demás fluya al LLM que ya tiene las herramientas correctas filtradas por estado.

## Cambios en `vendor-bot.ts`

### 1. Restringir `handleShoppingInterceptor` (línea 3864)
Solo invocar el interceptor cuando el mensaje tiene **intención de compra explícita**:

```
if (context.order_state === "shopping" && context.selected_vendor_id) {
  // Solo interceptar si parece pedido de producto (número, "dame X", "quiero X")
  const isPurchaseOrNumber = looksLikePurchaseIntent(message) || /^\d+$/.test(message.trim());
  if (isPurchaseOrNumber) {
    const shoppingResult = await handleShoppingInterceptor(message, context, supabase);
    if (shoppingResult) { ... return shoppingResult; }
  }
  // Todo lo demás → fluye al LLM con herramientas de shopping
}
```

Esto significa que "Siii", "genial", "lo confirmo", "qué hay", "carrito" ya no entran al parser de productos. Van directo al LLM que puede interpretar el contexto y llamar `ver_carrito`, `confirmar_pedido`, o responder con texto.

### 2. Simplificar los guards internos del interceptor
Dado que el interceptor ya solo recibe mensajes con intención de compra, se pueden eliminar los checks redundantes de `isGreetingOnly`, `wantsCartView`, `wantsFlowCommand`, `isOrderConfirmationSignal` dentro de `handleShoppingInterceptor` (líneas 157-178) — ya no son necesarios porque esos mensajes nunca llegan.

### 3. Reducir interceptores en idle/browsing (líneas 4282-4412)
Mantener solo:
- **Vendor list** (`wantsVendorList`) — necesario, es mecánico
- **Vendor by number** en browsing (línea 4417) — necesario, es mecánico
- **Vendor by name** desde `available_vendors_map` (línea 4334) — necesario
- **Vendor intent** ("qué hay en X") (línea 4301) — necesario

**Eliminar/reducir:**
- `explicitSearchIntent` (línea 4399-4412): eliminar este interceptor. El LLM tiene `buscar_productos` en sus herramientas para idle/browsing y puede decidir cuándo usarlo.
- `purchaseIntent` sin vendor (línea 4359-4397): mantener la lógica de auto-seleccionar vendor o guiar, pero no capturar el mensaje — dejar que fluya al LLM después de setear el estado.

### 4. Mejorar el system prompt para shopping
En `simplified-prompt.ts`, reforzar las instrucciones del estado `shopping`:

```
PASO ACTUAL: Comprando en ${vendor}.
- Para agregar productos: usá agregar_al_carrito con los productos del menú.
- Si el usuario confirma (sí, dale, listo, confirmo): mostrá el carrito con ver_carrito.
- Si pide ver el carrito: usá ver_carrito.
- Si quiere ver el menú: usá ver_menu_negocio.
- NUNCA respondas "no encontré X" — si no entendés, preguntá qué quiere.
```

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | Gate `handleShoppingInterceptor` con `looksLikePurchaseIntent`, eliminar `explicitSearchIntent` interceptor |
| `simplified-prompt.ts` | Mejorar instrucciones de shopping para que la IA maneje confirmaciones y comandos |

## Resultado esperado
- "Siii" en shopping → LLM interpreta como confirmación → muestra carrito/confirma
- "Lo confirmo!" → LLM entiende → avanza el pedido
- "genial, dame dos onion rings" → "dame dos onion rings" pasa al interceptor (tiene verbo de compra), "genial" se ignora
- "qué hay" en shopping → LLM llama `ver_menu_negocio`
- "carrito" → LLM llama `ver_carrito`
- Búsquedas en idle → LLM decide si llamar `buscar_productos` o `ver_locales_abiertos`

