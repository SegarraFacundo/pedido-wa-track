

# Plan: Hardening Determinista del Bot — Adaptación de las 12 Recomendaciones

## Auditoría: ¿Qué ya tenemos vs qué falta?

| # | Recomendación | Estado actual | Acción |
|---|---|---|---|
| 1 | Validación dura NLU | NLU parsea JSON + valida intent en lista | **Mejorar**: agregar fallback si JSON parse falla con contenido parcial |
| 2 | Intents válidos por estado | ✅ `VALID_INTENTS_BY_STATE` existe | **Mejorar**: agregar 3er retry → forzar soporte |
| 3 | Reintentos inteligentes | ✅ `retry_count` existe, 2do retry ofrece soporte | **Mejorar**: 3er retry forzar escalación automática a soporte |
| 4 | Mostrar contexto siempre | ❌ No se muestra contexto en mensajes intermedios | **Agregar**: helper `buildContextHeader()` para prefixear respuestas |
| 5 | Reset controlado | ✅ `cancelar/salir/inicio/menu principal` ya resetean | ✅ Listo |
| 6 | Fallback universal | Parcial: idle → menú; otros estados → hint genérico | **Mejorar**: fallback siempre con opciones numeradas |
| 7 | Confirmaciones obligatorias | ✅ `resumen_mostrado` + "¿Confirmar? Sí/No" existe | ✅ Listo |
| 8 | Opciones numeradas siempre | ✅ Menú contextual con números existe | **Mejorar**: agregar números en más respuestas intermedias |
| 9 | Separar IA vs lógica | ✅ NLU solo clasifica, state-machine controla todo | ✅ Listo |
| 10 | Respuestas desde backend | ✅ Precios, datos siempre de DB | ✅ Listo |
| 11 | Timeout de sesión | Parcial: 4h auto-cancel de pedidos, 7d cleanup | **Agregar**: 10min inactividad → soft reset con menú |
| 12 | Logs de depuración | ✅ `console.log` con intent, estado, acción | **Mejorar**: agregar log estructurado en tabla `bot_logs` |

## Cambios a implementar (solo lo que falta)

### 1. NLU: Validación más robusta (`nlu.ts`)

Agregar validación extra al parsear respuesta de la IA:
- Si el JSON no tiene `intent` string → `unknown`
- Si `confidence < 0.3` → `unknown` (umbral mínimo)
- Si la respuesta tiene texto fuera del JSON (IA "habló") → solo extraer JSON, descartar texto
- Log warning cuando la IA devuelve formato inválido

### 2. Reintentos: 3er intento fuerza escalación (`state-machine.ts`)

Actualmente 2do retry ofrece opciones de soporte. Agregar:
- **3er retry**: forzar reset a idle + mostrar menú principal automáticamente
- Nuevo i18n key: `error.forced_reset` — "No pude ayudarte. Volvemos al menú principal:"

Esto es mejor que forzar soporte (que puede no estar disponible). El reset limpia el estado corrupto que probablemente causa el loop.

### 3. Contexto visible: `buildContextHeader()` (`state-machine.ts`)

Helper que genera un header con info del estado actual del usuario:
```
📍 Negocio: Burger House
🛒 Carrito: 2 productos ($3500)
```

Se usa en:
- `handleInvalidIntent` — antes del hint
- `handleConfirmOrder` — ya lo tiene implícito en resumen
- Respuestas de error en estados de shopping/checkout

Solo se agrega cuando hay `selected_vendor_id` o `cart.length > 0`.

### 4. Timeout de inactividad 10min (`vendor-bot.ts` + `context.ts`)

En `getContext()`, verificar `updated_at` de la sesión:
- Si `updated_at > 10 min` y NO tiene pedido activo → soft reset:
  - Limpiar carrito, vendor, estado → idle
  - Retornar flag `was_inactive: true`
- En `vendor-bot.ts`, si `was_inactive` → responder con menú principal + "¡Hola de nuevo!"
- Si tiene pedido activo → NO resetear (el usuario puede volver a ver estado)

### 5. Fallback universal mejorado (`state-machine.ts` + `i18n.ts`)

Reemplazar el mensaje de error del 2do retry por opciones numeradas claras:

```
😔 No pude entender tu mensaje.

1️⃣ 🏪 Ver menú principal
2️⃣ 💬 Hablar con soporte
3️⃣ ❌ Cancelar y empezar de nuevo
```

Nuevo i18n key: `error.escalation_menu`

### 6. Log estructurado en DB (`vendor-bot.ts`)

Agregar función `logBotInteraction()` que guarda en tabla `bot_interaction_logs`:
- `phone`, `message`, `intent_detected`, `state_before`, `state_after`, `action_taken`, `response_preview`, `timestamp`

Esto requiere una nueva migración para crear la tabla. Se usa al final de cada interacción exitosa y en cada error.

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `nlu.ts` | Validación robusta: umbral confianza, sanitización JSON |
| `state-machine.ts` | 3er retry → reset forzado, `buildContextHeader()`, fallback mejorado |
| `i18n.ts` | Keys: `error.forced_reset`, `error.escalation_menu`, `welcome.inactive_return` |
| `vendor-bot.ts` | Timeout 10min inactividad, `logBotInteraction()` |
| `context.ts` | Retornar flag `was_inactive` si >10min sin actividad |
| `types.ts` | Agregar `was_inactive?: boolean` al context |
| Nueva migración | Tabla `bot_interaction_logs` |

## Orden de implementación

1. NLU hardening (independiente)
2. i18n keys nuevas
3. `buildContextHeader()` + fallback mejorado + 3er retry
4. Timeout de inactividad
5. Log estructurado + migración

