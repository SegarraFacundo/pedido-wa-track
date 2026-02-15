

# Fix: Bot ofrece método de pago no disponible en el resumen

## Problema

El bot muestra "Transferencia" en el resumen del pedido aunque el negocio no la tiene habilitada. Esto pasa porque `mostrar_resumen_pedido` simplemente muestra lo que hay en `context.payment_method` sin validarlo contra los métodos reales del vendedor. Si el LLM guardó un método incorrecto (o el contexto quedó contaminado de una sesión anterior), el resumen lo muestra como válido, y luego `crear_pedido` lo rechaza.

## Solucion

Agregar una validacion en `mostrar_resumen_pedido` que verifique el metodo de pago guardado contra los `payment_settings` reales del vendedor. Si no es valido, lo borra del contexto y pide al usuario que elija de nuevo.

## Cambio tecnico

### Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`

En el case `mostrar_resumen_pedido` (linea ~780), antes de mostrar el metodo de pago:

1. Consultar `payment_settings` del vendor actual desde la base de datos
2. Validar que `context.payment_method` este habilitado
3. Si NO es valido: limpiar `context.payment_method`, poblar `context.available_payment_methods` con los metodos reales, y mostrar la lista para que el usuario elija
4. Si ES valido: mostrarlo normalmente en el resumen

Esto garantiza que el resumen NUNCA muestre un metodo de pago que el negocio no acepta.

### Deployment

Redesplegar `evolution-webhook`.
