

# Plan: Agregar observaciones/notas a productos del carrito (sin validación)

## Enfoque

Las notas van directo con el pedido. El vendedor las ve en su dashboard cuando recibe el pedido. Sin paso extra de validación.

**Dos formas de agregar notas:**
1. Al agregar: "Quiero una milanesa sin sal" → se detecta y guarda automáticamente
2. Después: "Ponerle nota al 1: sin sal" → nueva tool `agregar_nota_producto`

## Cambios

| Archivo | Cambio |
|---------|--------|
| `types.ts` | Agregar `notes?: string` a `CartItem` |
| `tools-definitions.ts` | Agregar param `notes` a items de `agregar_al_carrito` + nueva tool `agregar_nota_producto` |
| `vendor-bot.ts` | Implementar `agregar_nota_producto`, mostrar notas en carrito/resumen, incluir notas en items del pedido |
| `simplified-prompt.ts` | Mencionar en estado `shopping` que el usuario puede agregar observaciones |
| `OrderCard.tsx` | Mostrar notas de cada item en la tarjeta del pedido del dashboard del vendedor |

## Detalle clave

- `CartItem.notes` es opcional — si el usuario no dice nada, no hay nota
- Las notas se persisten automáticamente en el JSONB de `items` en la tabla `orders` (no requiere migración)
- En el carrito se muestran así:
```text
1. Milanesa x1 — $5000
   📝 sin sal
2. Pizza x1 — $4000
```
- En el dashboard del vendedor, cada item con nota muestra un ícono 📝 con el texto

