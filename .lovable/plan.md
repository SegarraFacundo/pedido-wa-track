
# Bot Anti-Alucinaciones: 5 Fases Implementadas ✅

## Fase 1: Filtrado agresivo de herramientas por estado ✅
- `TOOLS_BY_STATE` en vendor-bot.ts restringe qué tools puede usar el LLM según el estado
- Ejemplo: en `idle` solo puede buscar/ver locales. En `needs_address` solo puede confirmar dirección.

## Fase 2: Interceptores deterministas pre-LLM ✅
- `needs_address` → todo texto (excepto cancelar) se trata como dirección sin pasar por LLM
- `idle/browsing` + palabra de comida → `buscar_productos` directo
- `browsing` + número → `ver_menu_negocio` directo
- `ayuda/help` → menú estático directo

## Fase 3: Prompt reducido a ~70 líneas ✅
- simplified-prompt.ts reducido de 433 a ~70 líneas
- Solo instrucciones del estado actual (no todos los estados)
- Sin reglas duplicadas ni contradictorias

## Fase 4: Respuestas directas sin reformateo LLM ✅
- `DIRECT_RESPONSE_TOOLS` retorna resultado de herramienta directamente al usuario
- Aplica a: ver_locales, ver_menu, ver_carrito, resumen, estado, ofertas, búsqueda
- Evita que el LLM reformatee, agregue texto innecesario o invente datos

## Fase 5: Menú de ayuda estático ✅
- Interceptor regex detecta "ayuda/help/opciones" y retorna texto fijo
- No pasa por el LLM

## Despliegue
- Edge function `evolution-webhook` redesplegada ✅
