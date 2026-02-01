
# Plan: Omitir Estado "En camino" para Pedidos de Retiro en Local

## Problema Identificado

Cuando un cliente elige **retiro en local (pickup)**, el panel del vendedor muestra el botón "Marcar como En camino" después de que el pedido está listo, lo cual no tiene sentido porque el cliente va a retirar el pedido en el local.

**Flujo actual (incorrecto para pickup):**
```
ready → delivering → delivered
```

**Flujo esperado para pickup:**
```
ready → delivered (salta "delivering")
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useRealtimeOrders.ts` | Agregar mapeo de `delivery_type` |
| `src/components/OrderCard.tsx` | Modificar `getNextStatus` para considerar `delivery_type` |
| `src/hooks/useRealtimeOrders.ts` | Actualizar mensajes de WhatsApp para pickup |

---

## Cambios Técnicos

### 1. Hook `useRealtimeOrders.ts` - Agregar mapeo de delivery_type

**Ubicación:** Líneas 32-64 (donde se formatean los pedidos)

```typescript
// Agregar al objeto formattedOrders:
delivery_type: order.delivery_type || 'delivery',
```

### 2. Componente `OrderCard.tsx` - Modificar flujo de estados

**Ubicación:** Líneas 30-41 (función `getNextStatus`)

Cambiar de función simple a función que recibe el tipo de entrega:

```typescript
const getNextStatus = (
  currentStatus: OrderStatus, 
  deliveryType?: 'delivery' | 'pickup'
): OrderStatus | null => {
  // Para retiro en local: saltar "delivering"
  if (deliveryType === 'pickup') {
    const pickupFlow: Record<OrderStatus, OrderStatus | null> = {
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'delivered',  // ⭐ Salta directamente a entregado
      delivering: 'delivered',
      delivered: null,
      cancelled: null,
    };
    return pickupFlow[currentStatus];
  }
  
  // Flujo normal para delivery
  const flow: Record<OrderStatus, OrderStatus | null> = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
    ready: 'delivering',
    delivering: 'delivered',
    delivered: null,
    cancelled: null,
  };
  return flow[currentStatus];
};
```

**Actualizar llamada:**
```typescript
// Línea 46: actualizar para pasar delivery_type
const nextStatus = getNextStatus(order.status, order.delivery_type);
```

### 3. Actualizar mensajes de notificación WhatsApp

**Ubicación:** `src/hooks/useRealtimeOrders.ts`, líneas 288-295

```typescript
const statusDescriptions = {
  confirmed: 'El vendedor está preparando tu pedido.',
  preparing: 'Tu pedido está siendo preparado.',
  ready: order.delivery_type === 'pickup' 
    ? 'Tu pedido está listo para retirar en el local.' 
    : 'Tu pedido está listo para entrega.',
  delivering: 'Tu pedido está en camino.',  // Solo para delivery
  delivered: order.delivery_type === 'pickup'
    ? '¡Gracias por retirarlo!'
    : '¡Gracias por tu compra!',
  cancelled: 'Si tienes alguna duda, contacta al vendedor.'
};
```

---

## Flujo Actualizado

```
┌─────────────────────────────────────────────────────────┐
│              PEDIDO TIPO: DELIVERY 🚚                   │
├─────────────────────────────────────────────────────────┤
│  pending → confirmed → preparing → ready → delivering   │
│                                              ↓          │
│                                          delivered      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              PEDIDO TIPO: PICKUP 🏪                     │
├─────────────────────────────────────────────────────────┤
│  pending → confirmed → preparing → ready → delivered    │
│                                     ↓                   │
│                          (salta "delivering")           │
└─────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Tipo de Pedido | Estado "Listo" | Botón Siguiente |
|----------------|----------------|-----------------|
| 🚚 Delivery | Listo | "Marcar como En camino" |
| 🏪 Pickup | Listo | "Marcar como Entregado" |

---

## Impacto

- **Archivos modificados:** 2
- **Riesgo:** Bajo (cambio de lógica condicional)
- **Beneficio:** UX más clara para vendedores y clientes con pedidos de retiro
