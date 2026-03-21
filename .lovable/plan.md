
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
- Prompt minimalista: ~30 líneas, solo clasifica en 23 intents posibles (incluye `greeting`)
- Sin herramientas (tools), sin historial largo
- Fallback: si la IA falla o no responde JSON válido → intent `unknown`

### `state-machine.ts` — Motor determinista ✅
- `processIntent(nlu, context, supabase)` → `{response, handled}`
- `VALID_INTENTS_BY_STATE`: mapeo de intents válidos por estado (incluye `greeting` en todos)
- `STEP_HINTS`: instrucciones específicas por estado para reintentos
- `handleInvalidIntent()`: en idle/completed/cancelled → muestra menú contextual; en otros estados → contador de reintentos con escalación tras 2 fallos
- `getContextLevel()`: determina nivel 1-4 según contexto actual
- `getContextualMenu()`: devuelve el menú apropiado según nivel
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

---

# Menú Principal Contextual con 4 Niveles ✅

## Problema
Las opciones del menú deben reflejar lo que el usuario **realmente puede hacer** según su contexto actual.

## Diseño: 4 niveles de contexto

### Nivel 1: Sin contexto (idle, sin nada previo)
1️⃣ 🏪 Ver negocios abiertos
2️⃣ 🔍 Buscar un producto
3️⃣ 🕐 Ver horarios
4️⃣ ❓ Ayuda

### Nivel 2: Con negocio seleccionado (browsing/shopping)
1️⃣ 📋 Ver menú de {vendor}
2️⃣ 🛒 Ver carrito
3️⃣ ✅ Confirmar pedido
4️⃣ 💬 Hablar con {vendor}
5️⃣ 🏪 Ver otros negocios
6️⃣ ❓ Ayuda

### Nivel 3: Con pedido activo (pending/confirmed)
1️⃣ 📦 Ver estado del pedido
2️⃣ ❌ Cancelar pedido
3️⃣ 💬 Hablar con el vendedor
4️⃣ ⭐ Calificar pedido
5️⃣ 🕐 Ver horarios
6️⃣ ❓ Ayuda

### Nivel 4: Pedido completado (order_completed)
1️⃣ ⭐ Calificar pedido
2️⃣ 🏪 Ver negocios abiertos
3️⃣ 🔍 Buscar un producto
4️⃣ ❓ Ayuda

## Implementación ✅

### `i18n.ts`
- 5 nuevas keys: `welcome.menu_clean`, `welcome.menu_vendor`, `welcome.menu_active_order`, `welcome.menu_completed`, `welcome.search_prompt`
- En 4 idiomas (es, en, pt, ja)

### `vendor-bot.ts`
- **Interceptor de saludos**: Regex para "hola", "buenas", "hey", etc. → devuelve menú contextual según nivel
- **Interceptor numérico**: Números 1-6 en estados idle/completed/cancelled → ejecuta acción directa según nivel

### `nlu.ts`
- Agregado intent `greeting` al tipo, INTENT_LIST, prompt de clasificación e intents válidos

### `state-machine.ts`
- `getContextLevel(context)`: Determina nivel 1-4 según pending_order_id, order_state, selected_vendor_id
- `getContextualMenu(context, lang)`: Devuelve menú i18n según nivel
- Handler `greeting` en switch → devuelve menú contextual
- `handleInvalidIntent`: En estados idle/completed/cancelled → devuelve menú contextual en vez de error
- `greeting` agregado a VALID_INTENTS_BY_STATE en todos los estados
- `STEP_HINTS.idle` actualizado para referenciar menú numerado

---

# Hardening Determinista del Bot ✅

## Cambios implementados (basado en 12 recomendaciones)

### 1. NLU: Validación robusta ✅ (`nlu.ts`)
- Extracción JSON más resiliente: busca `{}` si no hay code block
- Validación estricta: `typeof intent === "string"` + `typeof params === "object"`
- Umbral de confianza: `confidence < 0.3` → intent `unknown`
- Log warnings cuando la IA devuelve formato inválido
- Try/catch separado para JSON.parse

### 2. Reintentos: 3 niveles ✅ (`state-machine.ts`)
- 1er retry: hint del paso actual + context header
- 2do retry: menú de escalación numerado (menú / soporte / reset)
- 3er retry: **forzar reset a idle** + mostrar menú principal limpio

### 3. Context header ✅ (`state-machine.ts`)
- `buildContextHeader()`: muestra "📍 Negocio: X | 🛒 Carrito: N productos ($total)"
- Se usa en `handleInvalidIntent` para que el usuario siempre sepa dónde está

### 4. Timeout de inactividad 10min ✅ (`context.ts` + `vendor-bot.ts`)
- En `getContext()`: si `updated_at > 10min` y sin pedido activo → soft reset
- Flag `was_inactive` en el contexto
- En `vendor-bot.ts`: si `was_inactive` → "¡Hola de nuevo!" + menú principal
- No resetea si hay pedido activo

### 5. Fallback con opciones numeradas ✅ (`i18n.ts`)
- `error.escalation_menu`: 3 opciones numeradas (menú / soporte / reset)
- `error.forced_reset`: mensaje + menú principal
- `welcome.inactive_return`: bienvenida tras inactividad

### 6. Log estructurado en DB ✅ (`vendor-bot.ts` + migración)
- Tabla `bot_interaction_logs`: phone, message, intent, state_before/after, confidence, response
- `logBotInteraction()`: fire-and-forget, no bloquea la respuesta
- Índices en phone, created_at, intent_detected
- RLS: service_role puede escribir, admins pueden leer
