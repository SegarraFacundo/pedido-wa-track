

# Plan: Registrar TODAS las interacciones del bot en `bot_interaction_logs`

## Problema

La tabla `bot_interaction_logs` existe pero **nada inserta datos en ella**. No hay ni una sola línea de INSERT en todo `vendor-bot.ts`. Por eso el panel muestra 0 interacciones.

Además, el panel actual solo muestra errores por defecto. El usuario quiere ver **todas** las interacciones para analizar patrones de uso y mejorar el bot.

## Cambios

### 1. Insertar log en CADA interacción (`vendor-bot.ts`)

Al final de `handleVendorBot`, justo antes del `return finalResponse` (línea 4852), insertar en `bot_interaction_logs` con los datos disponibles del contexto:

```typescript
// Log ALL interactions (non-blocking)
const stateBefore = context.conversation_history.length > 2 
  ? context.conversation_history[context.conversation_history.length - 3]?.content?.slice(0, 100) 
  : null;

await supabase.from("bot_interaction_logs").insert({
  phone: normalizedPhone,
  message_preview: message.slice(0, 500),
  response_preview: finalResponse.slice(0, 500),
  intent_detected: lastToolUsed || "conversational",
  confidence: lastToolConfidence ?? null,
  action_taken: lastToolUsed || "text_response",
  state_before: orderStateBefore,
  state_after: context.order_state || "idle",
  error: null,
}).catch(e => console.error("Log insert error:", e));
```

Para capturar `orderStateBefore` y `lastToolUsed`, agregar variables al inicio de la función y actualizarlas durante el loop de tools:
- `orderStateBefore` = `context.order_state` capturado antes de procesar
- `lastToolUsed` = nombre de la última tool ejecutada en el loop

También loguear en el `catch` de error (línea 4853) con `error: errorMessage`.

### 2. Agregar filtro "Todas" como default (`BotInteractionReview.tsx`)

Cambiar el filtro inicial de `"errors"` a `"all"` para que el panel muestre todas las interacciones por defecto. Aumentar el límite de 100 a 200.

### 3. Agregar columna "Acción/Tool" visible en la tabla

Agregar una columna en la tabla que muestre `action_taken` (la tool usada), para que el admin pueda ver qué herramientas usa la gente y qué caminos siguen.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `vendor-bot.ts` | Agregar INSERT a `bot_interaction_logs` al final del flujo + en catch de error |
| `BotInteractionReview.tsx` | Default filter = "all", limit 200, columna de acción visible |

## Resultado

- Todas las conversaciones quedan registradas
- El admin puede filtrar por todas, errores, baja confianza o fallbacks
- Se puede analizar qué tools/caminos son más usados

