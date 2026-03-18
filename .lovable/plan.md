

## Plan: Arreglar bot que pierde el hilo y responde cualquier cosa

### Problemas raíz identificados (sesión 5493464558976)

1. **Idioma pegado en portugués** — la sesión tiene `"language":"pt"`, todas las respuestas deterministas salen en portugués
2. **"Háblame en español" no funciona** — falta `habla|háblame` en el regex de detección
3. **Usuario atrapado en `shopping` de Heladería Italiana** — pide hamburguesas de Burger House pero el bot solo responde sobre el vendor actual
4. **LLM llama `ver_ofertas` para preguntas no relacionadas** — cuando no entiende el mensaje, el LLM cae en herramientas irrelevantes
5. **Historial contaminado** — las respuestas erróneas en portugués se acumulan y el LLM las imita

### Cambios

**1. `i18n.ts` — Fix regex de detección de español**
- Agregar `habla|háblame|hablame` al regex de español en `detectExplicitLanguageRequest`
- Agregar `habla` como verbo reconocido para los otros idiomas ("habla en inglés", "habla en portugués")

**2. `vendor-bot.ts` — Reset defensivo de idioma para sesiones legacy**
- Después de `if (!context.language) context.language = 'es'`, agregar:
  - Si `context.language !== 'es'` y el usuario NO pidió explícitamente otro idioma en este mensaje → resetear a `'es'`
  - Esto corrige automáticamente todas las sesiones que quedaron en portugués

**3. `vendor-bot.ts` — Interceptor para cambio de negocio en `shopping`**
- Según tu preferencia: cuando el usuario pide algo de otro negocio estando en `shopping`, **NO cambiar** sino responderle que solo puede pedir del negocio actual
- Agregar un interceptor antes del LLM que detecte nombres de otros negocios del `available_vendors_map` y responda: "Estás comprando en *{vendor_actual}*. Si querés ver otro negocio, primero decí 'vaciar carrito' o 'nuevo pedido'."

**4. `vendor-bot.ts` — Respuesta breve cuando el LLM no entiende**
- En el fallback del LLM (cuando genera respuesta de texto libre), si estamos en `shopping` y la respuesta del LLM no tiene herramientas, verificar que la respuesta sea coherente
- Agregar un interceptor de "mensaje no reconocido" en `shopping` que responda: "No entendí tu mensaje. Podés:\n• Enviar un número del menú para agregar\n• Decir 'carrito' para ver tu pedido\n• Decir 'confirmar' para finalizar"

**5. Migración SQL — Limpiar sesiones legacy en portugués**
- UPDATE en `user_sessions` para reemplazar `"language":"pt"` → `"language":"es"` en `last_bot_message`
- También limpiar `conversation_history` corrupto de la sesión `5493464558976`

**6. Deploy** del edge function `evolution-webhook`

### Resultado esperado
- Todas las sesiones existentes vuelven a español automáticamente
- "Háblame en español" y variantes funcionan
- Cuando el usuario pide algo de otro negocio en `shopping`, recibe indicación clara sin perder su contexto actual
- Mensajes no reconocidos en `shopping` dan opciones concretas en vez de respuestas random del LLM

