
# Ocultar numero de cliente en mensaje inicial del chat

## Problema

Cuando un cliente solicita hablar con el vendedor, el mensaje inicial del sistema en el chat muestra el numero completo del cliente: `Cliente 5493464448309 solicito hablar con el vendedor`. Esto se genera en `vendor-bot.ts` linea 2031.

## Solucion

Modificar la linea 2031 en `supabase/functions/evolution-webhook/vendor-bot.ts` para enmascarar el numero del cliente, mostrando solo los ultimos 4 digitos.

### Cambio

Antes:
```
message: `Cliente ${context.phone} solicitó hablar con el vendedor`
```

Despues:
```
message: `Un cliente solicitó hablar con el vendedor`
```

Se elimina el numero por completo del mensaje del sistema, ya que el vendedor puede ver el identificador enmascarado (`Cliente ***8309`) en el encabezado del chat.

### Archivo a modificar
- `supabase/functions/evolution-webhook/vendor-bot.ts` (linea 2031)

### Despliegue
- Redesplegar la edge function `evolution-webhook`
