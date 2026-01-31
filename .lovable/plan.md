
# Plan: Implementar Validación de Stock en el Bot de WhatsApp

## Resumen del Problema

El sistema no está validando el stock antes de permitir agregar productos al carrito ni crear pedidos. Como resultado:
- Usuario pidió 3 Remeras cuando solo hay 2 en stock
- Usuario pidió 2 Buzos Sin Capucha cuando solo hay 1 en stock
- El pedido se creó de todas formas

La base de datos ya tiene los campos `stock_enabled` y `stock_quantity` en la tabla `products`, pero el código del bot no los usa.

---

## Cambios Necesarios

### 1. Mostrar Stock en el Menú (`ver_menu_negocio`)

**Archivo**: `supabase/functions/evolution-webhook/vendor-bot.ts`
**Líneas**: 520-525

Actualmente:
```typescript
for (const [i, p] of products.entries()) {
  menu += `${i + 1}. *${p.name}* $${Math.round(p.price).toLocaleString("es-PY")}`;
  if (p.image) menu += ` 📷 lapacho.ar/p/${p.id}`;
  menu += `\n`;
  if (p.description) menu += `   _${p.description}_\n`;
}
```

Cambiar a:
```typescript
for (const [i, p] of products.entries()) {
  // Verificar si el producto está agotado
  const isOutOfStock = p.stock_enabled && (p.stock_quantity === null || p.stock_quantity <= 0);
  const lowStock = p.stock_enabled && p.stock_quantity > 0 && p.stock_quantity <= 3;
  
  if (isOutOfStock) {
    menu += `${i + 1}. ~${p.name}~ ❌ AGOTADO\n`;
  } else {
    menu += `${i + 1}. *${p.name}* $${Math.round(p.price).toLocaleString("es-PY")}`;
    if (lowStock) menu += ` ⚠️ (${p.stock_quantity} disponibles)`;
    if (p.image) menu += ` 📷 lapacho.ar/p/${p.id}`;
    menu += `\n`;
    if (p.description) menu += `   _${p.description}_\n`;
  }
}
```

---

### 2. Validar Stock al Agregar al Carrito (`agregar_al_carrito`)

**Archivo**: `supabase/functions/evolution-webhook/vendor-bot.ts`
**Líneas**: 646-665

Cambiar la consulta de productos para incluir stock:
```typescript
const query = uuidRegex.test(item.product_id)
  ? supabase.from("products")
      .select("id, name, price, stock_enabled, stock_quantity")
      .eq("id", item.product_id).maybeSingle()
  : supabase.from("products")
      .select("id, name, price, stock_enabled, stock_quantity")
      .ilike("name", `%${item.product_name}%`)
      .eq("vendor_id", vendorId)
      .maybeSingle();
```

Después de encontrar el producto, validar stock:
```typescript
const { data: product } = await query;
if (product) {
  // Validar stock si está habilitado
  if (product.stock_enabled) {
    const currentStock = product.stock_quantity || 0;
    
    // Verificar cuántas unidades ya hay en el carrito de este producto
    const existingInCart = context.cart.find(c => c.product_id === product.id);
    const alreadyInCart = existingInCart?.quantity || 0;
    const totalRequested = alreadyInCart + item.quantity;
    
    if (currentStock <= 0) {
      return `❌ *${product.name}* está AGOTADO.\n\nElegí otro producto del menú. 😊`;
    }
    
    if (totalRequested > currentStock) {
      const canAdd = currentStock - alreadyInCart;
      if (canAdd <= 0) {
        return `⚠️ Ya tenés ${alreadyInCart} de *${product.name}* en el carrito (máximo disponible: ${currentStock}).\n\nNo podés agregar más unidades.`;
      }
      return `⚠️ Solo hay ${currentStock} unidades de *${product.name}* disponibles.\n\n` +
             `Ya tenés ${alreadyInCart} en el carrito. ¿Querés agregar ${canAdd} más?`;
    }
    
    console.log(`✅ Stock validated: ${product.name} - Requested: ${item.quantity}, Available: ${currentStock}`);
  }
  
  // Continuar agregando al carrito...
}
```

---

### 3. Re-validar Stock al Crear Pedido (`crear_pedido`)

**Archivo**: `supabase/functions/evolution-webhook/vendor-bot.ts`
**Ubicación**: Después de línea 1119 (antes de insertar el pedido)

Agregar validación final de stock:
```typescript
// 🛡️ VALIDACIÓN FINAL DE STOCK ANTES DE CREAR PEDIDO
const stockIssues: string[] = [];
for (const item of context.cart) {
  const { data: product } = await supabase
    .from("products")
    .select("name, stock_enabled, stock_quantity")
    .eq("id", item.product_id)
    .single();
  
  if (product && product.stock_enabled) {
    const available = product.stock_quantity || 0;
    if (item.quantity > available) {
      if (available <= 0) {
        stockIssues.push(`❌ *${product.name}* - AGOTADO`);
      } else {
        stockIssues.push(`⚠️ *${product.name}* - Pediste ${item.quantity}, solo hay ${available}`);
      }
    }
  }
}

if (stockIssues.length > 0) {
  return `🚫 *No se puede crear el pedido*\n\n` +
         `Algunos productos ya no tienen stock suficiente:\n\n` +
         stockIssues.join('\n') +
         `\n\nPor favor ajustá tu carrito con "modificar carrito" o eliminá los productos sin stock.`;
}
```

---

### 4. Deducir Stock al Confirmar Pedido (Trigger)

**Archivo**: Nueva migración SQL

Crear trigger que descuente stock cuando el pedido pase a estado "confirmed":
```sql
CREATE OR REPLACE FUNCTION deduct_stock_on_order_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  product_id UUID;
  quantity_ordered INT;
BEGIN
  -- Solo ejecutar cuando cambia a 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Iterar sobre los items del pedido
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      product_id := (item->>'product_id')::UUID;
      quantity_ordered := (item->>'quantity')::INT;
      
      -- Descontar stock solo si stock_enabled = true
      UPDATE products
      SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - quantity_ordered)
      WHERE id = product_id AND stock_enabled = true;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deduct_stock_on_order_confirmed ON orders;
CREATE TRIGGER trigger_deduct_stock_on_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_stock_on_order_confirmed();
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | 3 secciones: mostrar stock en menú, validar al agregar, validar al crear |
| Nueva migración SQL | Trigger para descontar stock automáticamente |

---

## Flujo Resultante

```text
1. Usuario ve menú
   → Productos agotados aparecen como "❌ AGOTADO"
   → Productos con poco stock muestran "(3 disponibles)"

2. Usuario intenta agregar producto agotado
   → Bot rechaza: "❌ Remera está AGOTADO"

3. Usuario intenta agregar más de lo disponible
   → Bot advierte: "Solo hay 2 unidades disponibles"

4. Usuario intenta crear pedido con stock insuficiente
   → Validación final detecta cambios de stock
   → Bot lista problemas y pide ajustar carrito

5. Pedido confirmado
   → Trigger automáticamente descuenta stock de productos
```

---

## Impacto

- **Archivos modificados**: 1 archivo TypeScript + 1 migración SQL
- **Líneas de código**: ~80 líneas nuevas
- **Riesgo**: Bajo (agrega validaciones sin romper flujo existente)
- **Requiere deploy**: Sí (edge function + migración)

---

## Sección Técnica

### Consideraciones de Concurrencia

El trigger SQL garantiza atomicidad en la deducción de stock. Sin embargo, para manejar casos de alta concurrencia donde dos usuarios podrían pedir el último item simultáneamente:

1. La validación en `agregar_al_carrito` es "optimista" - muestra disponibilidad actual
2. La validación en `crear_pedido` es la barrera final antes de insertar
3. El trigger garantiza que el stock nunca baje de 0

### Orden de Implementación

1. Crear migración SQL para el trigger
2. Modificar `ver_menu_negocio` para mostrar indicadores de stock
3. Modificar `agregar_al_carrito` para validar antes de agregar
4. Modificar `crear_pedido` para re-validar antes de insertar
5. Deploy edge function
6. Probar flujo completo
