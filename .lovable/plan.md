

# Estado de aplicación de los patches v1-v6

## ✅ Aplicado

| Patch | Cambio | Estado |
|-------|--------|--------|
| **v6** | `confusion_count` timeout en `pending_vendor_change` (2 intentos → limpiar) | ✅ Aplicado (líneas 3622-3628) |
| **v6** | Reset `confusion_count = 0` en sí/no (líneas 3564, 3601) | ✅ Aplicado |
| **v6** | Validación de pago vs `available_payment_methods` en interceptor (línea 3978-3982) | ✅ Aplicado |
| **Checkout flow fix** | Reordenamiento de interceptores (pago antes de shopping) | ✅ Aplicado |
| **Checkout flow fix** | `order_state = "checkout"` al mostrar pagos | ✅ Aplicado |
| **Base** | `confusion_count` como campo en contexto/types | ✅ Aplicado |

## ❌ NO Aplicado

| Patch | Cambio | Estado |
|-------|--------|--------|
| **v6** | Filtrar detección por texto de pago contra `available_payment_methods` (efectivo/cash solo si `available.includes('efectivo')`) | ❌ No aplicado — la detección por texto libre NO cruza con `available` |
| **v6** | Limpiar `delivery_address = undefined` cuando `delivery_type = 'pickup'` | ❌ No aplicado en ningún punto |
| **v5** | Negación inteligente (`negationOnly`, "no efectivo" vs "no efectivo, transferencia") | ❌ No aplicado |
| **v5** | Confirmaciones ambiguas: bloquear "sí" si faltan datos estructurales | ❌ No aplicado |
| **v5** | Advertencia de cambio de negocio con carrito activo | ❌ Parcial — `pending_vendor_change` existe pero no en `ver_menu_negocio` |
| **v5** | Doble envío: idempotencia reforzada en `crear_pedido` | ❌ No aplicado |
| **v4** | Regex ampliada de modificación (sumá/sacá/poné) en review | ❌ No aplicado |
| **v4** | Invalidación de `_preloaded_*` conflictivos | ❌ No aplicado (campos ni existen) |
| **v3** | `normalizePaymentInput()` centralizada con frases ("te transfiero") | ❌ No aplicado |
| **v3** | Validación de dirección (texto + número) | ❌ No aplicado |
| **v3** | `isVendorCurrentlyOpen()` centralizada | ❌ No aplicado |
| **v3** | Doble intención en review → volver a cart | ❌ No aplicado |
| **v3** | Limpieza de `_preloaded_*` + exclusión en `saveContext` | ❌ No aplicado |
| **v3** | Confirmación inteligente (datos completos → directo a resumen) | ❌ No aplicado |
| **v2** | `checkout_step` explícito (delivery_type → address → payment → review) | ❌ No aplicado |
| **v2** | `checkout_retry_count` (3 fallos → ofrecer salir) | ❌ No aplicado |
| **v2** | Transiciones seguras (solo si `tool_result.success`) | ❌ No aplicado |
| **v2** | Reducción de tools por estado (cart → solo carrito tools) | ❌ No aplicado |
| **v2** | Una tool por turno | ❌ No aplicado |

## Resumen

**Solo se aplicó el patch v6 (parcialmente) y el fix de checkout flow.** Los patches v2, v3, v4 y v5 NO fueron aplicados. De v6, falta la limpieza de dirección en pickup y el filtrado de detección de pago por texto contra `available_payment_methods`.

## Plan: Aplicar todos los cambios faltantes

Dado el volumen, propongo aplicar en orden de impacto y prioridad:

### Fase 1 — Cambios críticos faltantes de v6
1. **Filtrar detección por texto de pago** contra `context.available_payment_methods`
2. **Limpiar `delivery_address`** cuando `delivery_type = 'pickup'` en todos los puntos

### Fase 2 — v5: Protecciones de flujo
3. **Negación inteligente** en pago ("no efectivo" vs "no efectivo, transferencia")
4. **Bloquear confirmación** si faltan datos estructurales
5. **Idempotencia** en `crear_pedido` (check `pending_order_id`)

### Fase 3 — v3: Normalización y validación
6. **`normalizePaymentInput()`** centralizada con frases coloquiales
7. **Validación de dirección** (texto + número)
8. **Doble intención en review** → volver a cart (regex ampliada de v4)

### Fase 4 — v2: Flujo estructurado (mayor cambio)
9. **`checkout_step`** explícito con secuencia obligatoria
10. **`checkout_retry_count`** para protección de loops

Los cambios de v2 sobre reducción de tools y una tool por turno son configuración del prompt del LLM, no código — se pueden aplicar en `simplified-prompt.ts`.

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `vendor-bot.ts` | Fases 1-3: ~10 bloques quirúrgicos |
| `types.ts` | Agregar `checkout_step`, `checkout_retry_count` |
| `context.ts` | Persistir `checkout_step`, `checkout_retry_count` |
| `simplified-prompt.ts` | Regla de una tool por turno, prioridad CORE>AUX>GLOBAL |

