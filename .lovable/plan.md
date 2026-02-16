
# Ocultar datos del cliente en notificaciones al vendedor

## Problema

Las notificaciones de WhatsApp que recibe el vendedor (nuevo pedido, cancelacion, etc.) incluyen el nombre del cliente y la direccion completa. Como `customer_name` se guarda con el numero de telefono del cliente, el vendedor puede ver el numero y contactarlo por fuera de la plataforma.

## Solucion

Modificar la edge function `notify-vendor` para enmascarar/eliminar los datos sensibles del cliente en los mensajes que se envian al vendedor por WhatsApp.

### Cambios en `supabase/functions/notify-vendor/index.ts`

1. **Nuevo pedido (`new_order`)** - Linea 126-131:
   - Reemplazar `order.customer_name` con un identificador corto del pedido (ej: "Cliente #a1b2c3d4")
   - Simplificar la direccion: mostrar solo el barrio/zona (primer segmento antes de la coma), sin calle exacta
   - Mantener productos y total intactos

   Antes:
   ```
   Cliente: 5493512345678
   Direccion: Av. Colon 1234, Centro, Cordoba
   ```

   Despues:
   ```
   Cliente: Pedido #a1b2c3d4
   Direccion: Zona Centro (ver panel para detalles)
   ```

2. **Pedido cancelado (`order_cancelled`)** - Linea 138-140:
   - Reemplazar `order.customer_name` con el identificador del pedido
   
   Antes: `El pedido de 5493512345678 ha sido cancelado`
   Despues: `El pedido #a1b2c3d4 ha sido cancelado`

3. **Mensaje de cliente (`customer_message`)** - Linea 143-145:
   - Ya no muestra datos del cliente, no requiere cambios

### Funcion auxiliar

Agregar una funcion `maskCustomerIdentity` al inicio del archivo:

```typescript
function maskCustomerIdentity(orderId: string): string {
  return `Pedido #${orderId.slice(0, 8)}`;
}

function simplifyAddress(address: string): string {
  if (!address) return "Ver en panel";
  const firstPart = address.split(",")[0].trim();
  return `Zona ${firstPart} (ver panel para detalles)`;
}
```

### Resultado final del mensaje de nuevo pedido

```
Nueva Pedido #a1b2c3d4

Cliente: Pedido #a1b2c3d4
Direccion: Zona Av. Colon (ver panel para detalles)

Productos:
- 2x Pizza - $3000
- 1x Coca Cola - $1500

Total: $4500

Por favor, confirma el pedido desde tu panel de vendedor.
```

Esto obliga al vendedor a usar el panel para ver los datos completos del cliente, impidiendo el contacto directo por fuera de la plataforma.
