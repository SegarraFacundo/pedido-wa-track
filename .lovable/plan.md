# Bajar la tasa de equivocación del bot hacia 0

Tres frentes: darle mejor contexto al modelo, que la memoria del bot se invalide sola cuando cambia la base de datos, y un circuito de aprendizaje donde vos o el usuario le marcan que se equivocó.

---

## Parte A — Contexto: que no tenga que adivinar

El bot no falla por "el modelo": falla porque ve poco. Hoy el historial se limita a 1-6 turnos y **se borran los mensajes que contienen menús**. Si te mostró la heladería y decís "el segundo", el modelo ya no tiene la lista.

1. Subir el historial a 12 turnos en todos los estados.
2. Dejar de borrar los menús. En vez de borrarlos, reemplazarlos por un resumen compacto:
   `[Menú mostrado — Heladería Italiana: 1=Chocolate $2500, 2=Dulce de leche $2500, 3=Limón $2300]`
3. Guardar en la sesión `last_shown_list` (tipo, negocio, items con índice y precio) e inyectarlo en el prompt como dato duro, no como texto de chat.
4. En el bloque SITUACIÓN ACTUAL del prompt: última lista mostrada, negocio al que pertenece, y en una línea imperativa qué dato exacto se está esperando ahora.
5. Bajar `temperature` a 0.2 y agregar regla explícita: si el usuario nombra un producto que no está en la última lista, preguntar — nunca asumir.
6. Ordenar los interceptores por estado, no por posición en el archivo: primero comandos de escape, después solo los interceptores válidos para el estado actual. Así "confirmo el pedido" nunca puede caer en el interceptor de dirección.

---

## Parte B — Invalidación de memoria cuando cambia la DB

Hoy si un negocio cambia un precio, saca un producto o cierra, las sesiones activas siguen operando con el menú viejo que quedó en el historial y en el carrito.

**Versionado por negocio**
- Nueva columna `data_version` (entero) en `vendors`.
- Triggers en `products`, `vendor_offers`, `vendor_hours` y en los campos relevantes de `vendors` que hacen `data_version = data_version + 1` ante cualquier alta, baja o modificación.

**La sesión recuerda qué versión vio**
- Nuevo campo en el contexto: `vendor_data_version` (la versión vigente cuando se trajo el menú).
- En cada turno, antes de responder, el bot compara la versión guardada con la actual del negocio seleccionado.

**Qué hace cuando detecta que está desactualizado**
- Purga del historial los menús/precios viejos y el `last_shown_list`.
- Fuerza un `ver_menu_negocio` fresco antes de cualquier acción de compra.
- Revalida el carrito ítem por ítem contra los precios y disponibilidad actuales:
  - Precio cambió → avisa: "Ojo, la Pizza Napolitana pasó de $8000 a $8500. ¿Seguimos?"
  - Producto ya no disponible → lo saca del carrito y avisa cuál.
  - El negocio cerró o se pausó → corta el flujo con mensaje claro.

**Control manual desde el panel**
- Nueva tabla `session_invalidations` (negocio, motivo, alcance, fecha).
- Botón en el panel del vendedor y en el admin: "Actualizar sesiones activas de este negocio". Inserta la orden de invalidación; el bot la aplica en el siguiente mensaje de cada usuario afectado.
- Vista en el admin: sesiones activas por negocio, con estado del carrito y versión de datos que están usando, y acción para limpiar historial o memoria de una sesión puntual.

Con esto, cualquier cambio hecho desde la DB o desde el panel llega a los bots activos sin reiniciar nada.

---

## Parte C — Aprendizaje continuo: decirle que se equivocó

**Desde WhatsApp (el usuario)**
- Comandos: `te equivocaste`, `mal`, `no era eso`, `#error`.
- El bot toma el turno anterior completo (mensaje del usuario, estado, interceptor o herramienta que ganó, respuesta dada), lo guarda como corrección pendiente, pide en una línea qué debería haber hecho, y retoma el flujo sin perder el carrito.
- Respuesta corta y humana: "Perdón. ¿Qué querías que haga?" — y lo aplica en el mismo turno si puede.

**Nueva tabla `bot_corrections`**
- Mensaje del usuario, estado, respuesta equivocada, herramienta ejecutada, qué se esperaba, negocio, teléfono enmascarado, estado de revisión (`pendiente` / `aprobada` / `descartada`).

**Panel de revisión en el admin**
- Lista de correcciones pendientes, agrupadas por patrón (mismo estado + misma clase de error).
- Por cada una: aprobar (pasa a ser regla activa), editar la respuesta correcta, o descartar.

**Cómo se convierte en aprendizaje real**
- Las correcciones aprobadas se cargan como ejemplos few-shot en el prompt, filtradas por el estado actual (así no crecen infinito ni contaminan otros flujos).
- Límite de ~15 ejemplos por estado, priorizando los más repetidos.
- Las que se repiten mucho quedan marcadas como "candidata a regla de código": son las que conviene arreglar en la lógica en vez de en el prompt.

**Métricas para saber si baja de verdad**
- En `bot_interaction_logs`, registrar por turno: estado, interceptor ganador (o "LLM"), herramienta ejecutada, y si el usuario corrigió o repitió en el turno siguiente.
- Panel con tasa de error por estado y por interceptor, para ver dónde se rompe en vez de depender de capturas de WhatsApp.

---

## Notas técnicas

**Base de datos** (migraciones):
- `vendors.data_version` + triggers en `products`, `vendor_offers`, `vendor_hours`, `vendors`.
- Tablas nuevas: `bot_corrections`, `session_invalidations`. Con GRANTs y RLS (admin y el vendedor dueño).

**Edge function** `supabase/functions/evolution-webhook/`:
- `types.ts` — `last_shown_list`, `vendor_data_version` en `ConversationContext`.
- `context.ts` — chequeo de versión y purga de memoria al cargar el contexto.
- `vendor-bot.ts` — historial a 12 turnos, temperatura, orden de interceptores, comando de corrección, logging por turno.
- `simplified-prompt.ts` — situación actual enriquecida, few-shots de correcciones aprobadas.
- `shopping-interceptor.ts` — interceptores condicionados al estado, revalidación de carrito.

**Frontend**:
- Panel admin: revisión de correcciones, sesiones activas por negocio, métricas de error.
- Panel vendedor: botón de actualizar sesiones activas.

**Tests**: `conversation.test.ts` ya existe como red de seguridad. Se agregan casos para "ver menú" con un solo vendor, "confirmo el pedido" en `needs_address`, nota sobre producto ya en carrito, y carrito con precio desactualizado.

## Orden sugerido

1. Parte A (mayor impacto inmediato)
2. Parte B (versionado + invalidación)
3. Parte C (correcciones y métricas)
