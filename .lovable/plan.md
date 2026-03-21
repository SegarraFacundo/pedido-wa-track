
# Bot Anti-Alucinaciones: 5 Fases + Fix Shopping Loop ✅

## Fases 1-5: Implementadas ✅
- Filtrado de herramientas por estado (TOOLS_BY_STATE)
- Interceptores deterministas pre-LLM
- Prompt reducido ~70 líneas
- Respuestas directas sin reformateo (DIRECT_RESPONSE_TOOLS)
- Menú de ayuda estático

## Fix: Shopping Loop (menú en loop) ✅
### Problema: En estado `shopping`, el LLM llamaba `ver_menu_negocio` en vez de `agregar_al_carrito`
### Solución:
1. **Interceptor determinista shopping**: Detecta números ("2"), "N producto" ("2 remeras"), "quiero N producto" antes del LLM → busca en DB → `agregar_al_carrito` directo
2. **Bloqueo ver_menu_negocio en shopping**: Si el LLM llama `ver_menu_negocio` estando en shopping, retorna error forzando `agregar_al_carrito`
3. **Función `handleShoppingInterceptor`**: Busca productos del vendor en DB por índice o nombre fuzzy
