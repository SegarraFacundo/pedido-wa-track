
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

## Bot: Inline ternary → t() migration ✅
- Added 13 label keys to `i18n.ts` (label.order, label.payment, label.cash, etc.)
- Replaced all ~15 inline `lang === 'es' ? ...` ternaries in `tool-handlers.ts` and `vendor-bot.ts`
- Fixed missing PT/JA translations (e.g., "Holder" → proper `t('label.account_holder', lang)`)
- Zero remaining inline ternaries in bot code

## Ver horario de negocio + Pausa temporal vendor ✅
### Bot: `ver_horario_negocio` (determinista)
- Tool definition en `tools-definitions.ts`
- Handler en `tool-handlers.ts`: busca vendor, consulta `vendor_hours`, formatea por día con estado actual
- `TOOLS_BY_STATE`: disponible en todos los estados
- `DIRECT_RESPONSE_TOOLS`: respuesta directa sin reformateo LLM
- Interceptor regex en `vendor-bot.ts`: "horario", "schedule", "horários", "営業時間", "a qué hora", "what time"
- i18n: `schedule.header`, `schedule.closed`, `schedule.currently_open/closed`, `schedule.no_hours`, `schedule.ask_vendor`
- Help menu actualizado en 4 idiomas con sección de horarios

### Dashboard: Pausa temporal
- `VendorSettings.tsx`: Toggle `is_active` mejorado con card prominente, estados visuales y descripción clara
- `VendorDashboard.tsx`: Banner destructive cuando `vendor.is_active === false`
- Sin cambios de DB (usa campo `is_active` existente)

---

# Fix: Bot pierde hilo y responde en portugués ✅

## Problema
- Sesiones legacy con `"language":"pt"` → todas las respuestas deterministas en portugués
- "Háblame en español" no funcionaba (faltaba `habla/háblame` en regex)
- Usuario en `shopping` de un negocio pero el bot respondía sobre otro
- LLM divagaba con respuestas irrelevantes en estado `shopping`

## Solución implementada

### 1. `i18n.ts` — Fix regex detección explícita de idioma ✅
- Agregado `habla|háblame|hablame` a TODOS los patrones de detección (es, en, pt, ja)
- Agregado `castellano` como alias de español

### 2. `vendor-bot.ts` — Reset defensivo de idioma ✅
- Si `context.language !== 'es'` y NO hay petición explícita de idioma en el mensaje actual → reset a `'es'`
- Corrige automáticamente todas las sesiones legacy sin migración SQL

### 3. `vendor-bot.ts` — Interceptor cambio de negocio en `shopping` ✅
- Si el usuario menciona otro negocio del `available_vendors_map` estando en `shopping`, responde:
  "⚠️ Estás comprando en *{vendor}*. Si querés ver otro negocio, primero decí 'vaciar carrito' o 'nuevo pedido'."

### 4. `vendor-bot.ts` — Fallback determinista en `shopping` ✅
- Si el LLM no usa herramientas en estado `shopping`, en vez de devolver texto libre, responde con opciones concretas:
  "No entendí tu mensaje 🤔\n• Enviar número del menú\n• Decir 'carrito'\n• Decir 'confirmar'\n• Decir 'menú'"

### 5. `i18n.ts` — Nuevas keys ✅
- `shopping.wrong_vendor`: Mensaje de bloqueo de cambio de negocio (4 idiomas)
- `shopping.not_understood`: Fallback con opciones concretas (4 idiomas)
