
# Plan: Confirmacion programatica post-resumen

## Problema

Cuando el usuario dice "si" despues de ver el resumen del pedido, el modelo (con `tool_choice: "auto"`) NO llama `crear_pedido`. En vez de eso, alucina un mensaje diciendo "ya tenes un pedido activo" que es falso (el pedido anterior ya fue entregado y `pending_order_id` es `undefined`).

Los logs confirman:
- `order_state: "shopping"`, `pending_order_id: undefined`
- El modelo responde con texto puro (0 tool calls)
- La respuesta es inventada por el modelo

## Solucion

Agregar un **manejo programatico** de confirmaciones post-resumen, similar al que ya existe para `pending_vendor_change`. Si `resumen_mostrado = true` y el usuario dice "si/dale/confirmo", llamar `crear_pedido` directamente sin pasar por el LLM.

## Cambio

### Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`

Despues del bloque de `pending_vendor_change` (linea ~2894) y antes de agregar el mensaje al historial, insertar:

```typescript
// MANEJO PROGRAMATICO: Confirmacion de pedido post-resumen
// Cuando resumen_mostrado = true y el usuario confirma, llamar crear_pedido
// directamente sin pasar por el LLM (que alucina "pedido activo" inexistente)
if (context.resumen_mostrado && !context.pending_order_id) {
  const userResponse = message.toLowerCase().trim();
  const isConfirmation = /^(s[ií]|si|yes|dale|ok|confirmo|listo|confirmar|vamos|va)$/i.test(userResponse);
  const isCancellation = /^(no|nop|cancel|cancela|cambiar)/i.test(userResponse);
  
  if (isConfirmation) {
    // Llamar crear_pedido directamente
    const result = await ejecutarHerramienta("crear_pedido", {
      direccion: context.delivery_address,
      metodo_pago: context.payment_method,
    }, context, supabase);
    
    await saveContext(context, supabase);
    return result;
  }
  
  if (isCancellation) {
    context.resumen_mostrado = false;
    await saveContext(context, supabase);
    // Dejar que el LLM maneje la cancelacion/modificacion
  }
}
```

### Resultado esperado

| Situacion | Antes | Despues |
|-----------|-------|---------|
| "si" post-resumen | LLM alucina "pedido activo" | Llama crear_pedido directamente |
| "no" post-resumen | Sin cambios | Resetea resumen, LLM maneja |
| Mensaje ambiguo post-resumen | Sin cambios | Pasa al LLM normalmente |

### Riesgo

Bajo. Solo intercepta confirmaciones explicitas ("si", "dale", "ok") cuando `resumen_mostrado = true` y no hay pedido activo. Cualquier otro mensaje sigue el flujo normal del LLM.

### Archivo modificado
- `supabase/functions/evolution-webhook/vendor-bot.ts` (1 bloque nuevo)

### Despliegue
Redesplegar `evolution-webhook`.
