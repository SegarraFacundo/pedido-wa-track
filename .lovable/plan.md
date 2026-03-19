

## Plan: Actualizar el system prompt del bot con instrucciones anti-alucinación reforzadas

### Contexto

El prompt actual en `simplified-prompt.ts` es minimalista (~60 líneas). Querés reemplazarlo con uno más robusto que incluya reglas explícitas de decisión, control de alucinaciones y documentación de herramientas.

**Importante**: El bot usa OpenAI function calling nativo (no JSON manual), así que el formato `{"action": "nombre_herramienta"}` que pegaste no aplica directamente. Voy a adaptar tus instrucciones al sistema existente.

### Cambios en `simplified-prompt.ts`

**`buildSystemPrompt()`** - Reescribir el prompt incorporando:

1. **Reglas críticas** del prompt que pegaste:
   - NUNCA inventes productos, precios, promociones, horarios o negocios
   - NUNCA respondas usando memoria; toda información debe provenir de herramientas
   - NO completes pedidos sin confirmación del resumen
   - Preguntate "¿Tengo el dato real?" antes de responder

2. **Reglas de decisión** (adaptadas a function calling):
   - Hambre/comida → `buscar_productos`
   - Qué hay abierto → `ver_locales_abiertos`
   - Elige local → `ver_menu_negocio`
   - Quiere pagar → primero `mostrar_resumen_pedido`
   - Pregunta por pedido → `ver_estado_pedido`
   - Pide humano → `hablar_con_vendedor`

3. **Control de alucinaciones** reforzado:
   - Si no tenés datos, llamá herramienta antes de emitir palabra
   - NUNCA reformatees salida de herramientas
   - context.cart es la ÚNICA fuente de verdad

4. Mantener las instrucciones por estado (`getStateInstructions`) y el contexto dinámico (carrito, vendor, dirección, etc.) que ya existen

### Resultado

El LLM recibirá instrucciones más estrictas y explícitas, reduciendo alucinaciones y respuestas fuera de contexto sin cambiar la arquitectura del bot.

