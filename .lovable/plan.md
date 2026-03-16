

## Plan: Ver horario de negocio (bot) + Baja temporal de vendor (dashboard)

### Dos funcionalidades

**1. Bot WhatsApp: "Ver horario" de un negocio**
El usuario podrá consultar el horario completo de un negocio específico directamente desde el chat. Es una herramienta determinista (sin LLM), como las demás.

**2. Dashboard vendor: Pausa temporal**
El vendor ya tiene un toggle `is_active` en Settings, pero no tiene contexto claro de "baja temporal". Se mejorará la UX con un botón prominente de "Pausar negocio" que desactiva `is_active` y muestra un banner visible cuando está pausado. El bot ya filtra vendors con `is_active = false` en `ver_locales_abiertos`.

---

### Cambios técnicos

**A. Nueva herramienta `ver_horario_negocio` (bot)**

1. **`tools-definitions.ts`**: Agregar herramienta `ver_horario_negocio` con parámetro `vendor_id` (nombre o número de la lista).

2. **`tool-handlers.ts`**: Implementar case `ver_horario_negocio`:
   - Busca el vendor (misma lógica de búsqueda que `ver_menu_negocio`: por índice, nombre, UUID)
   - Consulta `vendor_hours` para obtener todos los días con sus horarios
   - Formatea respuesta mostrando cada día con horarios o "Cerrado"
   - Indica si está abierto AHORA

3. **`bot-helpers.ts`**: Agregar `ver_horario_negocio` a los estados `idle`, `browsing`, `shopping` y estados de pedido activo en `TOOLS_BY_STATE`. Agregar a `DIRECT_RESPONSE_TOOLS`.

4. **`i18n.ts`**: Agregar strings traducidos:
   - `schedule.header`: "🕐 Horarios de {vendor}"
   - `schedule.today_open` / `schedule.today_closed`
   - `schedule.day_closed`: "Cerrado"
   - `schedule.currently_open` / `schedule.currently_closed`
   - Nombres de días en 4 idiomas
   - Agregar opción "Ver horario de un negocio" al menú de ayuda (`help.full`) en los 4 idiomas

5. **`vendor-bot.ts`**: Agregar interceptor regex para "horario", "schedule", "horário", "営業時間", "what time", "a qué hora" que llama directamente a `ver_horario_negocio` (determinista, sin pasar por LLM). Si hay un vendor seleccionado en el contexto, lo usa; si no, pide que elija uno.

**B. Pausa temporal en Dashboard vendor**

6. **`VendorDashboard.tsx`**: Agregar banner prominente cuando `vendor.is_active === false` indicando que el negocio está pausado y no recibirá pedidos.

7. **`VendorSettings.tsx`**: Mejorar el toggle existente de `is_active` con mejor copy: "⏸️ Pausar negocio temporalmente" con descripción clara de que no aparecerá en el listado ni recibirá pedidos mientras esté pausado. Agregar un card de alerta cuando está desactivado.

### Sin cambios de base de datos
El campo `is_active` ya existe en `vendors` y el bot ya filtra por él. No se necesitan migraciones.

