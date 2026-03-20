
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

## Bot: Inline ternary → t() migration ✅
- Added 13 label keys to `i18n.ts` (label.order, label.payment, label.cash, etc.)
- Replaced all ~15 inline `lang === 'es' ? ...` ternaries in `tool-handlers.ts` and `vendor-bot.ts`

---

# Arquitectura 100% Determinista con IA solo como NLU ✅

## Concepto
Bot transformado de "IA decide y responde" a **máquina de estados pura**:
- La IA **solo clasifica el intent** del usuario (1 llamada, sin herramientas, sin decisiones)
- Toda la lógica, respuestas y flujo son **código determinista**
- Cada estado tiene pasos definidos, respuestas fijas y manejo de errores
- Tras 2 intentos fallidos en un paso, se ofrece ayuda humana o volver al menú principal

## Archivos creados/modificados

### `nlu.ts` — Natural Language Understanding ✅
- `classifyIntent(message, context)` → `{intent, params, confidence}`
- Usa Lovable AI Gateway (gemini-2.5-flash-lite) como primera opción, fallback a OpenAI
- Prompt minimalista: ~30 líneas, solo clasifica en 22 intents posibles
- Sin herramientas (tools), sin historial largo
- Fallback: si la IA falla o no responde JSON válido → intent `unknown`

### `state-machine.ts` — Motor determinista ✅
- `processIntent(nlu, context, supabase)` → `{response, handled}`
- `VALID_INTENTS_BY_STATE`: mapeo de intents válidos por estado
- `STEP_HINTS`: instrucciones específicas por estado para reintentos
- `handleInvalidIntent()`: contador de reintentos con escalación tras 2 fallos
- Handlers individuales para cada intent ejecutando `ejecutarHerramienta()`
- 0 texto libre del LLM — todo viene de i18n o tool-handlers

### `vendor-bot.ts` — Refactored ✅
- Eliminada dependencia de `openai@4.77.3`
- Eliminado import de `buildSystemPrompt`
- Eliminado el loop OpenAI con `tool_calls` (líneas 843-950)
- Reemplazado por: `classifyIntent()` → `processIntent()` → respuesta fija
- Interceptores deterministas se mantienen intactos (resuelven ~80% de mensajes)
- Error handling actualizado para API genérica

### `types.ts` — Updated ✅
- Agregado `retry_count?: number` al ConversationContext

## Flujo actual

```text
MENSAJE → Interceptores (regex/keywords) → 80% resuelto
                                          ↓ no matcheó
                                    NLU (classifyIntent)
                                          ↓ {intent, params}
                                    State Machine (processIntent)
                                          ↓ {response}
                                    Respuesta fija (t('key'))
```

## Resultado
- **0 alucinaciones**: La IA nunca genera texto que el usuario vea
- **100% predecible**: Misma entrada → misma salida siempre
- **Menos tokens**: 1 llamada corta vs. múltiples iteraciones con tools
- **Escalación automática**: 2 fallos → ofrecer soporte o menú principal
