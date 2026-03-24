
# Ultra Hardening Patches v2-v6 — COMPLETADO

## ✅ Todos los patches aplicados

### v6 — Consistencia de estado
- ✅ `confusion_count` timeout en `pending_vendor_change` (2 intentos → limpiar)
- ✅ Filtrar detección de pago por texto contra `available_payment_methods` (usando `normalizePaymentInput`)
- ✅ Limpiar `delivery_address` en pickup (todos los puntos: interceptor, tool, resumen, crear_pedido, confirmación)

### v5 — Protecciones de flujo
- ✅ Negación inteligente: "no efectivo" → NO selecciona, re-pregunta
- ✅ Bloquear confirmación si faltan datos estructurales (delivery_type, address, payment_method)
- ✅ Idempotencia en `crear_pedido` — si `pending_order_id` existe y está activo, reutilizar

### v4 — Detección ampliada
- ✅ Regex ampliada de modificación: sumá/sacá/poné/más/otro/cambiá en review → volver a shopping

### v3 — Normalización y validación
- ✅ `normalizePaymentInput()` centralizada con frases coloquiales ("te transfiero", "cbu", "alias")
- ✅ `isValidAddress()` — validación de dirección (texto + número obligatorio)
- ✅ Doble intención en review → volver a cart (detecta modificaciones)

### v2 — Flujo estructurado
- ✅ `checkout_step` y `checkout_retry_count` en types.ts y context.ts (persistidos)
- ✅ `TOOLS_BY_STATE` ya existente — filtrado de herramientas por estado
- ✅ Regla de UNA tool por turno en prompt
- ✅ Prioridad CORE > AUX > GLOBAL en prompt

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `types.ts` | `checkout_step`, `checkout_retry_count` |
| `context.ts` | Persistencia de nuevos campos + limpieza en reset |
| `vendor-bot.ts` | normalizePaymentInput, isValidAddress, negación, idempotencia, CART_MODIFICATION_REGEX, bloqueo confirmación sin datos |
| `simplified-prompt.ts` | Reglas de una tool por turno y prioridad CORE>AUX>GLOBAL |
