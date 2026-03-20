

# Plan: Arquitectura 100% Determinista con IA solo como NLU

## Concepto

Transformar el bot de un modelo "IA decide y responde" a una **máquina de estados pura** donde:
- La IA **solo clasifica el intent** del usuario (1 llamada, sin herramientas, sin decisiones)
- Toda la lógica, respuestas y flujo son **código determinista**
- Cada estado tiene pasos definidos, respuestas fijas y manejo de errores
- Tras 2 intentos fallidos en un paso, se ofrece ayuda humana o volver al menú principal

```text
┌─────────────────────────────────────────────────┐
│                 MENSAJE USUARIO                  │
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────▼────────┐
              │  INTERCEPTORES  │  (regex, números, keywords)
              │  DETERMINISTAS  │  ~80% de mensajes resueltos aquí
              └────────┬────────┘
                       │ no matcheó
              ┌────────▼────────┐
              │   IA → INTENT   │  Solo clasifica: "browse_stores",
              │   (NLU layer)   │  "add_product", "confirm", etc.
              │   Sin tools     │  Responde JSON: {intent, params}
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  STATE MACHINE  │  Código determinista ejecuta
              │  (switch/case)  │  la acción según estado+intent
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  RESPUESTA FIJA │  Templates i18n, nunca texto
              │  (t('key'))     │  libre del LLM
              └─────────────────┘
```

## Intents que clasificará la IA

```text
browse_stores     → ver locales abiertos
search_product    → buscar producto específico (params: query)
select_vendor     → elegir negocio (params: vendor_ref)
view_menu         → ver menú del negocio actual
add_to_cart       → agregar producto (params: product_ref, quantity)
remove_from_cart  → quitar producto
view_cart         → ver carrito
confirm_order     → confirmar/listo/dale
select_delivery   → elegir delivery (params: type)
give_address      → dar dirección (params: address)
select_payment    → elegir método de pago (params: method)
check_status      → ver estado del pedido
cancel_order      → cancelar pedido
rate_order        → calificar pedido
rate_platform     → calificar plataforma
talk_to_human     → hablar con vendedor/soporte
view_schedule     → ver horarios
help              → ayuda
reset             → reiniciar
change_language   → cambiar idioma (params: lang)
unknown           → no se entiende
```

## Manejo de errores por paso

Cada estado tiene un contador `retry_count`. Si el intent no es válido para el estado actual:
1. **Intento 1**: Repite el paso actual con instrucción más clara
2. **Intento 2**: Ofrece opciones: "hablar con alguien" o "volver al menú principal"

## Cambios técnicos

### 1. Nuevo archivo: `nlu.ts` (Natural Language Understanding)
- Función `classifyIntent(message, state, context)` → `{intent, params, confidence}`
- Usa OpenAI con prompt minimalista: "Classify this message into one intent. Return JSON only."
- Sin herramientas (tools), sin historial largo, prompt ~20 líneas
- Fallback: si la IA falla o no responde JSON válido → intent `unknown`

### 2. Nuevo archivo: `state-machine.ts`
- Función `processIntent(intent, params, state, context, supabase)` → `{response, newState}`
- Switch por estado, dentro switch por intent
- Ejecuta las mismas funciones de `tool-handlers.ts` pero sin pasar por el LLM
- Maneja `retry_count` y ofrece escalación tras 2 fallos

### 3. Refactor: `vendor-bot.ts`
- Los interceptores existentes se mantienen (ya son deterministas)
- Reemplazar el bloque OpenAI (líneas 843-950) por:
  1. `classifyIntent()` → obtener intent
  2. `processIntent()` → ejecutar acción
  3. Retornar respuesta fija
- Eliminar `buildSystemPrompt()`, `filterToolsByState()`, y el loop de tool_calls

### 4. Actualizar: `types.ts`
- Agregar `retry_count: number` al `ConversationContext`

### 5. Actualizar: `i18n.ts`
- Agregar keys para mensajes de error por paso:
  - `step.invalid_input` → "No entendí. {instrucción del paso actual}"
  - `step.need_help` → "¿Necesitás ayuda? Escribí 'soporte' o 'menú principal'"

### 6. Mantener sin cambios
- `tool-handlers.ts` (las funciones de ejecución siguen igual)
- `bot-helpers.ts` (interceptores siguen igual)
- `emergency.ts`, `context.ts`, `i18n.ts` (estructura base)

## Resultado esperado

- **0 alucinaciones**: La IA nunca genera texto que el usuario vea
- **100% predecible**: Misma entrada → misma salida siempre
- **Flexibilidad humana**: El usuario puede decir "agregame 2 de esos" y la IA lo clasifica como `add_to_cart {quantity: 2}`
- **Menos tokens**: 1 llamada corta a OpenAI vs. múltiples iteraciones con tools
- **Debugging simple**: Cada respuesta es trazable al estado + intent

