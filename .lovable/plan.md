
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

---

# Soporte Multi-idioma (ES, EN, PT, JA) — Fase 1 ✅

## Bot de WhatsApp — Auto-detección ✅
- `i18n.ts`: Diccionario con ~30 strings en 4 idiomas + detectLanguage() + regex multi-idioma
- `types.ts`: Campo `language` en ConversationContext
- `context.ts`: Persiste y carga `language`
- `simplified-prompt.ts`: getLangInstructions() adapta tono/idioma del system prompt
- `vendor-bot.ts`: Detecta idioma en primer mensaje, usa t() para strings fijos, regex multi-idioma (confirm/cancel/payment/help)

## Web — Selector manual (sin auto-detección) ✅
- `react-i18next` + `i18next` instalados
- `src/i18n/index.ts`: Config con lng='es', lee de localStorage
- `src/i18n/locales/{es,en,pt,ja}.json`: Traducciones de la Landing
- `src/components/LanguageSelector.tsx`: Dropdown con banderas
- `src/pages/Landing.tsx`: Migrado a t('key')

## Fase 2 (Pendiente)
- Migrar resto de páginas web (Términos, Privacidad, Contacto, Auth, Dashboards)
