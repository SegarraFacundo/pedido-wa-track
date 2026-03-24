

# Plan: Dejar que la IA interprete el contexto en vez de interceptores rígidos

## Problema
El bloque `isProductQuery` (línea 4375-4387) es un catch-all que envía **cualquier mensaje** que no sea saludo, comando o gibberish directamente a `buscar_productos`. Esto significa que la IA nunca tiene oportunidad de interpretar el contexto — el interceptor determinista decide antes. Cada vez que aparece una palabra nueva ("confirmado", "genial", "remera", etc.) hay que agregarla manualmente a una lista de exclusión. Es un juego infinito de whack-a-mole.

## Solución
Reducir los interceptores deterministas a lo **mínimo necesario** (selección de vendor por número, dirección, pago) y dejar que el resto fluya al LLM, que ya tiene el system prompt con contexto completo y herramientas filtradas por estado.

## Cambios en `vendor-bot.ts`

### 1. Eliminar el catch-all `isProductQuery` → `buscar_productos`
El bloque de líneas ~4370-4387 que envía todo a `buscar_productos` se elimina. En su lugar, solo se mantiene el interceptor de `foodKeywords` **cuando el usuario explícitamente dice "buscar X"** o usa palabras de descubrimiento ("busco", "hay", "dónde encuentro").

### 2. Restringir `foodKeywords` a intención de búsqueda explícita
En vez de disparar `buscar_productos` por cualquier mención de comida, solo hacerlo cuando hay un verbo de búsqueda: "busco pizza", "hay helado?", "dónde encuentro cerveza". Si dice "pizza" a secas en idle, dejar que la IA decida (puede preguntar "¿Querés que busque pizza?" o mostrar negocios).

### 3. Dejar que la IA use las herramientas disponibles
Cuando no hay interceptor que atrape el mensaje, el flujo llega al LLM (línea 4508). La IA ya tiene:
- `buscar_productos` en sus herramientas (para idle/browsing)
- `agregar_al_carrito` (para shopping)
- El system prompt con el contexto completo

La IA puede interpretar "remera" como búsqueda de producto, "confirmado" como confirmación, "genial, dame dos más" como agregado al carrito — sin necesidad de regex.

### 4. Quitar `tool_choice: "required"` en primera iteración
Línea 4514: actualmente se fuerza `tool_choice: "required"` en estados pre-checkout. Esto obliga a la IA a llamar una herramienta incluso cuando debería solo responder con texto (ej. "¿Qué querés hacer?"). Cambiar a `"auto"` siempre para que la IA decida.

### 5. Mantener interceptores esenciales (no se tocan)
- Selección de vendor por número en browsing (línea 4391)
- Dirección en needs_address (línea 4234)
- Pago en checkout (línea 4045)
- Confirmación de pedido (línea 4936)
- Shopping interceptor para parsing multi-producto (línea 124) — solo cuando ya está en shopping con vendor

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | Eliminar catch-all `isProductQuery`, restringir `foodKeywords`, cambiar `tool_choice` a `auto` |

## Resultado esperado
- La IA interpreta el contexto y decide qué herramienta usar (o si responder con texto)
- No hay más listas de palabras ignoradas que mantener
- Los interceptores solo quedan para flujos mecánicos (números, direcciones, pagos)
- "Remera" en idle → la IA llama `buscar_productos` por su cuenta
- "Confirmado" en shopping → la IA entiende la intención sin regex
- "Genial, dame dos onion rings" → la IA no se confunde con "genial"

