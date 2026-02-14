

# Plan: Corregir Comportamiento Errático del Bot al Buscar Productos

## Problema

Cuando el usuario busca un producto (ej: "coca cola"), el bot encuentra resultados en varios negocios. Al elegir uno (ej: "de la pizzeria"), el bot:

1. Intenta agregar al carrito sin haber seleccionado el negocio correctamente
2. Usa un mapa de vendors (`available_vendors_map`) desactualizado de una operacion anterior
3. Termina mostrando el menu de un negocio completamente diferente (Supermercado El Ahorro)
4. Inventa que "no encontro Coca Cola en Pizzeria Don Luigi" cuando si la tenia

## Causa Raiz

La herramienta `buscar_productos` NO actualiza `available_vendors_map` en el contexto. Cuando el usuario responde eligiendo un negocio de los resultados de busqueda, el bot usa un mapa viejo de `ver_locales_abiertos`, mapeando "1" al negocio equivocado.

## Cambios

### 1. `supabase/functions/evolution-webhook/vendor-bot.ts` - Herramienta `buscar_productos`

**Guardar el mapa de vendors de los resultados de busqueda en el contexto**, igual que lo hace `ver_locales_abiertos`.

```
Actual (lineas 65-79):
- Formatea resultados con UUIDs visibles para la IA
- NO actualiza available_vendors_map
- La IA no puede mapear "de la pizzeria" → vendor correcto

Nuevo:
- Actualizar available_vendors_map con los vendors encontrados
- Quitar los UUIDs del texto visible (la IA no los necesita)
- El formato sera: "1. Pizzeria Don Luigi\n   - Coca Cola 1L - $8000\n"
- Guardar contexto con saveContext despues de actualizar el mapa
```

Cambio concreto en lineas 65-79:

```typescript
// Formatear resultados SIN exponer UUIDs
const vendorMap = [];
let resultado = `Encontre estos negocios con "${args.consulta}":\n\n`;
data.results.forEach((r, i) => {
  const idx = i + 1;
  resultado += `${idx}. *${r.vendor.name}*\n`;
  r.products.forEach((p, j) => {
    resultado += `   - ${p.name} - $${p.price}\n`;
  });
  resultado += `\n`;
  vendorMap.push({ index: idx, name: r.vendor.name, vendor_id: r.vendor.id });
});

// Guardar mapa para que ver_menu_negocio pueda resolver "1", "pizzeria", etc.
context.available_vendors_map = vendorMap;
context.last_vendors_fetch = new Date().toISOString();
await saveContext(context, supabase);

resultado += `Decime el numero o nombre del negocio para ver su menu completo.`;
return resultado;
```

### 2. `supabase/functions/evolution-webhook/simplified-prompt.ts` - Regla para buscar_productos

Agregar instruccion explicita en el estado `browsing` para que despues de `buscar_productos`, la IA SIEMPRE llame a `ver_menu_negocio` antes de intentar agregar al carrito.

En la seccion de estado "browsing" (linea ~121-129), agregar:

```
DESPUES DE buscar_productos:
- Si el usuario elige un negocio de los resultados → Llama ver_menu_negocio (NUNCA agregar_al_carrito directo)
- El usuario DEBE ver el menu completo antes de poder agregar productos
- NUNCA intentes agregar productos basandote solo en los resultados de busqueda
```

### 3. Desplegar edge function

Redesplegar `evolution-webhook` con los cambios.

---

## Resultado Esperado

| Paso | Antes (roto) | Despues (correcto) |
|------|-------------|-------------------|
| 1. "coca cola" | Busca, muestra 2 negocios | Busca, muestra 2 negocios + actualiza mapa |
| 2. "de la pizzeria" | Intenta agregar al carrito directo, falla, muestra menu equivocado | Llama ver_menu_negocio("pizzeria"), muestra menu correcto |
| 3. "agregala" | N/A (ya delirio) | Agrega Coca Cola del menu de la pizzeria |

## Impacto

- **Archivos modificados:** 2 (vendor-bot.ts, simplified-prompt.ts)
- **Riesgo:** Bajo (cambio en formato de resultados y regla de prompt)
- **Beneficio critico:** Elimina el problema principal que impide lanzar el bot a produccion
