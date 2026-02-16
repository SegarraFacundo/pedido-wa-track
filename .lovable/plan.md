
# Fix: Actualizar pedido cancelado en tiempo real en el panel del vendedor

## Problema

Cuando un cliente cancela un pedido desde WhatsApp, el panel del vendedor no refleja el cambio de forma visible. El realtime SI actualiza el estado internamente, pero:
1. El toast de cancelacion es generico ("Pedido actualizado") y facil de ignorar
2. La tarjeta del pedido solo cambia el badge de color, sin ningun aviso prominente
3. El vendedor puede no darse cuenta y seguir intentando avanzar el pedido

## Solucion

Dos cambios concretos:

### 1. Toast de cancelacion prominente (useRealtimeOrders.ts)

Cuando llega un evento realtime de cancelacion, mostrar un toast **destructivo** con duracion extendida en lugar del generico "Pedido actualizado":

- Titulo: "PEDIDO CANCELADO POR EL CLIENTE"
- Variante: `destructive` (rojo)
- Duracion: 15 segundos
- Solo para cancelaciones; el resto de estados mantiene el toast actual

### 2. Banner visual en tarjeta cancelada (OrderCard.tsx)

Agregar un banner rojo prominente dentro de la tarjeta cuando `order.status === 'cancelled'`, visible inmediatamente debajo del header:

```
---------------------------------------------
|  El cliente cancelo este pedido           |
---------------------------------------------
```

- Fondo rojo con icono de alerta
- Texto claro: "Este pedido fue cancelado"
- Reemplaza los botones de accion (ya lo hace parcialmente, pero el banner lo hace obvio)

## Detalle tecnico

**Archivo 1: `src/hooks/useRealtimeOrders.ts`**
- En el handler de UPDATE (linea ~179), verificar si `newStatus === 'cancelled'` antes del toast generico
- Si es cancelacion: toast destructivo con titulo alarmante y duracion 15s
- Si no: mantener el toast actual

**Archivo 2: `src/components/OrderCard.tsx`**
- Despues del CardHeader (linea ~260), agregar un bloque condicional:
  - Si `order.status === 'cancelled'`: mostrar un `div` con fondo `bg-red-100 border-red-300` con icono `XCircle` y texto "Este pedido fue cancelado por el cliente"
- Esto es un cambio puramente visual, no afecta logica
