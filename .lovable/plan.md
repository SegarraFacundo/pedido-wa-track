
Objetivo: cortar el bucle donde el usuario intenta seguir comprando y el bot vuelve a buscar negocios en vez de avanzar al pedido.

Diagnóstico (confirmado con logs/DB):
- Do I know what the issue is? Sí.
- En `vendor-bot.ts` se ejecutó: `⏱️ Inactivity reset: 2695 min` justo antes del mensaje “BUeno dame 3 palos...”.
- Ese reset dejó `order_state=browsing`, `selected_vendor_id=null` y carrito vacío.
- Luego el interceptor genérico de `idle/browsing` tomó la frase completa como búsqueda y llamó `buscar_productos`, generando el bucle.

Plan de implementación

1) Corregir reset por inactividad (causa raíz)
- Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`, `context.ts`, `types.ts`.
- Dejar de usar `bot_interaction_logs` como fuente principal de “última actividad” (está desfasada para este flujo).
- Agregar/usar `context.last_interaction_at` (persistido en `last_bot_message`) y calcular actividad con el timestamp más reciente real del contexto (`last_interaction_at`, `last_menu_fetch`, `last_vendors_fetch`).
- Ejecutar reset solo si realmente hay inactividad prolongada y sin pedido activo.
- Subir el umbral de reset (hoy 10 min) a una ventana más segura para checkout (ej. 2h/4h configurable).

2) Blindar continuidad de compra antes de la búsqueda global
- Archivo: `vendor-bot.ts`.
- Insertar un interceptor “continuar pedido” antes del bloque genérico `isProductQuery`.
- Si el mensaje es tipo carrito (“dame X”, “quiero X”, cantidades) y hay contexto de vendor/compra reciente, enrutar a `handleShoppingInterceptor` en vez de `buscar_productos`.
- Si no hay vendor seleccionado, responder guiando a elegir local (o auto-seleccionar cuando haya un único vendor en `available_vendors_map`).

3) Ajustar el detector genérico de búsqueda
- Archivo: `vendor-bot.ts`.
- Evitar que frases imperativas largas de compra se envíen literal a `buscar_productos`.
- Mantener `buscar_productos` para intención de descubrimiento (“buscar…”, “qué hay…”, “categorías…”) y no para “agregar al carrito”.

4) Pruebas de regresión del flujo end-to-end
- Archivo: `supabase/functions/evolution-webhook/conversation.test.ts` (o tests nuevos del webhook).
- Casos mínimos:
  - “qué hay en el vivero” → menú → “dame 3 palos…” agrega al carrito (no búsqueda de negocios).
  - Con log histórico viejo no debe resetear una sesión activa reciente.
  - Mensaje de compra en browsing sin vendor: guía a elegir local (sin loop).

5) Verificación operativa post-fix
- Desplegar `evolution-webhook`.
- Validar en logs que:
  - no aparezca reset falso al minuto,
  - no haya `idle → browsing (buscar_productos)` para frases de “dame X” cuando venía de menú,
  - el flujo complete pedido hasta dirección/pago/creación sin desvíos.

Detalles técnicos
- Archivos foco: `vendor-bot.ts` (routing/interceptores), `context.ts` + `types.ts` (nuevo timestamp confiable), tests de conversación.
- No cambiaremos herramientas ni schema de pedidos; el ajuste es de enrutamiento y coherencia de estado.
- Resultado esperado: el bot prioriza continuidad de compra y solo vuelve a búsqueda cuando realmente el usuario quiere explorar.
