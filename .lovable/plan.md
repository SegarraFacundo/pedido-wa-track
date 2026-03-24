

# Plan: Ultra Hardening Patch v6 — 3 controles de consistencia

## Cambios en `vendor-bot.ts`

### 1. Limpieza de `pending_vendor_change` por timeout

El interceptor actual (línea 3548-3618) re-pregunta indefinidamente si el usuario no dice sí/no. Agregar un contador de reintentos: si el usuario envía 2 mensajes consecutivos que no son sí/no, limpiar `pending_vendor_change` y dejar fluir el mensaje al flujo normal.

```typescript
// Línea ~3609, reemplazar el bloque de "respuesta no clara":
context.confusion_count = (context.confusion_count || 0) + 1;
if (context.confusion_count >= 2) {
  // El usuario ignoró la pregunta, cancelar cambio pendiente
  context.pending_vendor_change = undefined;
  context.confusion_count = 0;
  await saveContext(context, supabase);
  // NO retornar — dejar que el mensaje fluya al resto del flujo
} else {
  // Primera vez no clara: re-preguntar
  await saveContext(context, supabase);
  return clarificationResponse;
}
```

Resetear `confusion_count = 0` cuando el usuario responde sí o no (líneas 3553 y 3588).

### 2. Validación de método de pago vs vendor

El interceptor de pago (línea 3956-3964) ya valida contra `available_payment_methods` del contexto. Pero el texto libre podría detectar un método que no está en esa lista. Reforzar: en la detección por texto (líneas 3937-3944), solo aceptar métodos que estén en `context.available_payment_methods`:

```typescript
// Línea ~3937, reemplazar detección por texto:
if (!selectedMethod) {
  const available = context.available_payment_methods || [];
  if ((normalizedMsg.includes('efectivo') || normalizedMsg.includes('cash')) && available.includes('efectivo')) {
    selectedMethod = 'efectivo';
  } else if ((normalizedMsg.includes('transferencia') || normalizedMsg.includes('transfer')) && available.includes('transferencia')) {
    selectedMethod = 'transferencia';
  } else if ((normalizedMsg.includes('mercado') || normalizedMsg.includes('mp')) && available.includes('mercadopago')) {
    selectedMethod = 'mercadopago';
  }
}
```

Esto evita que el bot seleccione "efectivo" cuando el vendor solo tiene "transferencia".

### 3. Consistencia delivery/pickup: limpiar dirección si es pickup

En todos los puntos donde se setea `delivery_type = 'pickup'`, limpiar `delivery_address`:

- **Línea ~3889** (interceptor delivery mode → pickup confirmado): agregar `context.delivery_address = undefined;`
- **Línea ~4219** (confirmación → vendor solo pickup): agregar `context.delivery_address = undefined;`
- **Herramienta `seleccionar_tipo_entrega`**: buscar donde se setea pickup y agregar `context.delivery_address = undefined;`

Además, en `mostrar_resumen_pedido` y `crear_pedido`, si `delivery_type === 'pickup'`, forzar `delivery_address = undefined` como guard final.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | Timeout de pending_vendor_change (2 intentos), filtrar métodos de pago por disponibilidad del vendor en detección por texto, limpiar dirección en pickup |

## Resultado esperado

- Usuario ignora pregunta de cambio de negocio → se cancela y sigue el flujo normal
- "Efectivo" cuando vendor solo acepta transferencia → no se selecciona
- Pickup nunca tiene dirección residual de un delivery anterior

