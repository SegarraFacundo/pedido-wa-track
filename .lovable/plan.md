

## Plan: Internacionalizar todas las respuestas del bot de WhatsApp

### Problema
El bot detecta correctamente el idioma del usuario y el menú de ayuda ya está traducido, pero **todas las respuestas de las herramientas (tools) siguen hardcodeadas en español**. Las herramientas de `DIRECT_RESPONSE_TOOLS` (como `ver_locales_abiertos`, `ver_carrito`, `ver_menu_negocio`) devuelven texto directamente al usuario sin pasar por el LLM, así que siempre se ven en español.

### Alcance
Se modifican **4 archivos** del edge function `evolution-webhook`:

### Cambios por archivo

**1. `i18n.ts` — Agregar ~40 claves de traducción faltantes**

Muchas claves ya existen (`vendors.header`, `vendors.open_now`, etc.) pero no se usan en `tool-handlers.ts`. Faltan claves para:
- Labels dinámicos: "Horario", "Rating", "reseñas", "Dirección no disponible", "Datos actualizados a las", "AGOTADO", "Delivery y Retiro", etc.
- Respuestas de buscar_productos: "Encontré estos negocios con...", "No encontré negocios abiertos con..."
- Respuestas de herramientas no-directas: agregar_al_carrito, vaciar_carrito, seleccionar_tipo_entrega, crear_pedido, cancelar_pedido, calificar, soporte, etc.
- Strings de `bot-helpers.ts` (interceptor de shopping): "está AGOTADO", "Ya tenés N de..."

Todo en los 4 idiomas (ES, EN, PT, JA).

**2. `tool-handlers.ts` — Reemplazar strings hardcodeados con `t()`**

En cada case del switch, usar `const lang = (context.language || 'es') as Language;` y reemplazar:
- `ver_locales_abiertos` (líneas 118-190): headers, "ABIERTOS AHORA", "CERRADOS", "Horario", "Rating", "reseñas", "Decime el número...", "Datos actualizados a las"
- `buscar_productos` (líneas 33-53): "Encontré estos negocios...", "No encontré...", "Decime el número..."
- `ver_menu_negocio`: "AGOTADO", "Delivery y Retiro", textos del footer
- `ver_carrito`, `mostrar_resumen_pedido`, `ver_estado_pedido`, `ver_ofertas`: ya tienen claves en i18n, solo falta usarlas
- `agregar_al_carrito`, `vaciar_carrito`, `crear_pedido`, `cancelar_pedido`, etc.: mensajes de éxito/error
- Todos los mensajes de "Ya tenés un pedido activo..." (aparece en múltiples cases)

**3. `vendor-bot.ts` — Traducir strings del flujo principal**

- Línea 59: respuesta del comando reset ("¡Listo! Borré toda tu memoria...")
- Prompts de cambio de vendor
- Respuestas de interceptores (confirmación, cancelación, etc.)

**4. `bot-helpers.ts` — Traducir interceptor de shopping**

- Mensajes de stock agotado: "está AGOTADO", "Ya tenés N de..."
- Mensaje de éxito al agregar: "Productos agregados al carrito de..."
- Usar las claves existentes `cart.added` donde sea posible

### Estrategia técnica
- Cada tool case obtiene `lang` de `context.language || 'es'`
- Se usa la función `t(key, lang)` existente con interpolación `{variable}`
- Las claves nuevas siguen la convención existente: `categoria.subclave`
- No se cambia ninguna lógica de negocio, solo strings

### Riesgo y mitigación
- El archivo `tool-handlers.ts` (1666 líneas) crece mínimamente porque se reemplazan strings, no se agregan
- `i18n.ts` crece ~200 líneas con las nuevas claves pero queda dentro de los límites del bundler
- Se requiere redeploy del edge function después de los cambios

