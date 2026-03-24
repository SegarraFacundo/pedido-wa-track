

# Plan: Auto-seleccionar modo de entrega cuando solo hay una opción

## Problema
Cuando el usuario confirma el pedido, el bot siempre pregunta "¿Lo retirás en el local o te lo enviamos?" incluso cuando el vendor solo permite una opción. Esto ya se maneja correctamente en la herramienta `confirmar_pedido` (líneas 1670-1686), pero el interceptor de confirmación (líneas 4089-4105) tiene un `else` que muestra ambas opciones como fallback.

## Cambio en `vendor-bot.ts`

### 1. Eliminar el fallback genérico (líneas 4100-4105)
Reemplazar el bloque que muestra "¿Lo retirás...?" por defecto:

- **Si `allows_delivery && allows_pickup`**: preguntar cuál prefiere (único caso donde se muestra la pregunta)
- **Si no hay `selected_vendor_id`** (línea 4103-4104): buscar el vendor config igualmente o asumir delivery como default
- **Si solo delivery**: auto-setear `delivery_type = 'delivery'` y pedir dirección
- **Si solo pickup**: auto-setear `delivery_type = 'pickup'` y saltar a métodos de pago

Esto unifica la lógica con lo que ya hace `confirmar_pedido` en líneas 1670-1686.

### 2. Agregar el caso `allows_delivery && allows_pickup` explícito
En el bloque `else` actual (línea 4100), agregar la condición que falta para solo preguntar cuando ambos están habilitados.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | Líneas 4089-4105: unificar lógica de auto-selección de delivery/pickup con la de `confirmar_pedido` |

## Resultado esperado
- Vendor solo delivery → "Este negocio trabaja solo con delivery. ¿Tu dirección?"
- Vendor solo pickup → "Este negocio trabaja solo con retiro en local." + métodos de pago
- Vendor ambos → "¿Lo retirás en el local o te lo enviamos?"
- Sin vendor (edge case) → asumir delivery y pedir dirección

