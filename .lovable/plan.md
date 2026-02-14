

# Plan: Forzar al Bot a Usar Herramientas Obligatoriamente

## Problema Real

Los cambios anteriores (limitar historial a 4 mensajes, reglas en el prompt) NO funcionaron porque:

1. La `conversation_history` guarda las respuestas del asistente que **contienen menus completos** como texto plano
2. Ejemplo: el historial tiene un mensaje como "Te muestro el menu del Supermercado El Ahorro: 1. Leche $8500, 2. Pan $5000..."  
3. Cuando el usuario dice "coca cola", gpt-4o-mini **ve ese menu en el historial** y responde con esos datos en lugar de llamar a `buscar_productos`
4. El modelo ignora las reglas del prompt porque ya tiene "datos suficientes" en el historial

## Solucion (3 cambios)

### 1. Forzar `tool_choice: "required"` en estados idle/browsing

En `vendor-bot.ts`, cuando el estado es `idle` o `browsing`, usar `tool_choice: "required"` en vez de `"auto"` para la **primera iteracion** del loop. Esto obliga al modelo a llamar una herramienta sin excepcion.

```
Iteracion 1 (idle/browsing): tool_choice = "required"
Iteracion 2+: tool_choice = "auto" (para que pueda responder con texto)
```

### 2. Limpiar historial al entrar a idle/browsing  

En `vendor-bot.ts`, antes de construir los mensajes, si el estado es `idle` o `browsing`, **filtrar del historial cualquier mensaje que contenga menus o resultados de busqueda**. Concretamente:

- Si el estado es `idle`: enviar solo el ultimo mensaje del usuario (0 historial previo)
- Si el estado es `browsing`: enviar maximo los ultimos 2 mensajes

Esto elimina la fuente de datos viejos que el modelo usa para alucinar.

### 3. Desplegar

Redesplegar `evolution-webhook`.

---

## Detalle Tecnico

### Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`

**Cambio A - Linea ~3357**: Reducir historial a 0 en idle

```typescript
// Antes:
const historyLimit = (context.order_state === "idle" || context.order_state === "browsing") ? 4 : 15;

// Despues:
const historyLimit = context.order_state === "idle" ? 1 
  : context.order_state === "browsing" ? 2 
  : 15;
```

Solo 1 mensaje (el mensaje actual del usuario) en idle, 2 en browsing, 15 en otros estados.

**Cambio B - Linea ~3375-3381**: Forzar tool_choice en primera iteracion

```typescript
// Antes:
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages,
  tools: tools,
  temperature: 0,
  max_tokens: 800,
  tool_choice: "auto",
});

// Despues:
const forceTools = (context.order_state === "idle" || context.order_state === "browsing") 
  && iterationCount === 1;

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages,
  tools: tools,
  temperature: 0,
  max_tokens: 800,
  tool_choice: forceTools ? "required" : "auto",
});
```

Esto garantiza que en la primera iteracion, el modelo SIEMPRE llame una herramienta cuando esta en idle/browsing.

---

## Por que esto funciona

| Situacion | Antes | Despues |
|-----------|-------|---------|
| Usuario dice "coca cola" en idle | AI ve menu viejo en historial, responde sin herramienta | AI NO tiene historial viejo + OBLIGADA a llamar herramienta |
| Usuario dice "de la pizzeria" en browsing | AI usa datos viejos del historial | AI tiene solo 2 mensajes recientes + obligada a llamar herramienta |
| Usuario en shopping/checkout | Sin cambios, historial necesario para contexto | Sin cambios |

## Archivos modificados

- `supabase/functions/evolution-webhook/vendor-bot.ts` (2 cambios puntuales)

## Riesgo

Bajo. El unico cambio es forzar herramientas en idle/browsing (donde SIEMPRE deberian usarse) y reducir historial en esos estados. Los estados de compra/checkout no se tocan.

Hay un caso edge: si el usuario manda un mensaje off-topic como "hola" en idle, el modelo sera forzado a llamar una herramienta. Pero como el prompt ya tiene reglas para off-topic, la herramienta mas probable sera `ver_locales_abiertos` y luego respondera normalmente.
