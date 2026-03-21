

# Fix: Remoción parcial del carrito y formato de precios

## Problemas detectados

1. **"sacame 2 cocas" elimina TODAS las cocas**: `handleRemoveFromCart` hace `splice()` que borra el ítem completo, sin importar la cantidad pedida
2. **NLU no extrae cantidad para remoción**: "sacame 2 cocas" solo pasa `{product_ref: "cocas"}`, pierde el "2"
3. **Precios con decimales rotos**: `$7499.460000000001` por error de punto flotante

## Cambios

### 1. NLU (`nlu.ts`) — Extraer `quantity` en `remove_from_cart`

Agregar `quantity` como parámetro en los ejemplos de remoción:
```
"sacame 2 cocas" → {"intent": "remove_from_cart", "params": {"product_ref": "cocas", "quantity": 2}}
"sacar el 2" → sigue siendo por índice sin quantity (quita 1 unidad)
"sacame todas las cocas" → {"intent": "remove_from_cart", "params": {"product_ref": "cocas", "quantity": "all"}}
```

### 2. State Machine (`state-machine.ts`) — Remoción parcial por cantidad

Reescribir `handleRemoveFromCart` para:
- Si `quantity` viene, reducir esa cantidad del ítem (no eliminar todo)
- Si no viene `quantity`, reducir 1 unidad
- Solo hacer `splice` si la cantidad resultante llega a 0
- Ejemplo: tengo 3 cocas, "sacame 2" → queda 1 coca

### 3. Formato de precios (`bot-helpers.ts` + `state-machine.ts`)

Usar `Math.round()` o `.toFixed(0)` en todos los cálculos de total para evitar `$7499.460000000001` → `$7499`

### 4. Redespliegue

Redesplegar `evolution-webhook` con los 3 fixes.

