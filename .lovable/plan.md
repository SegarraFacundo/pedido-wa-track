

# Plan: Menú principal contextual con opciones lógicas

## Problema

Las opciones del menú deben reflejar lo que el usuario **realmente puede hacer** según su contexto actual. No tiene sentido ofrecer "Hablar con soporte" si no hay vendedor ni pedido — ¿con quién hablaría? Tampoco "Estado de pedido" ni "Calificar" si no hay pedido.

## Diseño: 4 niveles de contexto

```text
NIVEL 1: Sin contexto (idle, sin nada previo)
─────────────────────────────────────
1️⃣ 🏪 Ver negocios abiertos
2️⃣ 🔍 Buscar un producto
3️⃣ 🕐 Ver horarios
4️⃣ ❓ Ayuda

NIVEL 2: Con negocio seleccionado (browsing/shopping)
─────────────────────────────────────
1️⃣ 📋 Ver menú de {vendor}
2️⃣ 🛒 Ver carrito
3️⃣ ✅ Confirmar pedido
4️⃣ 💬 Hablar con {vendor}
5️⃣ 🏪 Ver otros negocios
6️⃣ ❓ Ayuda

NIVEL 3: Con pedido activo (pending/confirmed)
─────────────────────────────────────
1️⃣ 📦 Ver estado del pedido
2️⃣ ❌ Cancelar pedido
3️⃣ 💬 Hablar con el vendedor
4️⃣ ⭐ Calificar pedido
5️⃣ 🕐 Ver horarios
6️⃣ ❓ Ayuda

NIVEL 4: Pedido completado (order_completed)
─────────────────────────────────────
1️⃣ ⭐ Calificar pedido
2️⃣ 🏪 Ver negocios abiertos
3️⃣ 🔍 Buscar un producto
4️⃣ ❓ Ayuda
```

## Cambios técnicos

### 1. `i18n.ts` — 4 keys de menú + `welcome.search_prompt`

- `welcome.menu_clean` — Nivel 1 (4 opciones)
- `welcome.menu_vendor` — Nivel 2 (6 opciones, con `{vendor}` placeholder)
- `welcome.menu_active_order` — Nivel 3 (6 opciones)
- `welcome.menu_completed` — Nivel 4 (4 opciones)
- `welcome.search_prompt` — "🔍 ¿Qué producto buscás?"

En los 4 idiomas (es, en, pt, ja).

### 2. `vendor-bot.ts` — Interceptor de saludos + números

**a) Interceptor de saludos** (antes de NLU):
- Regex: `/^(hola|buenas|hey|hi|hello|oi|olá|buen\s*d[ií]a|buenos?\s*d[ií]as|buenas?\s*tardes?|buenas?\s*noches?|que\s*tal|qué\s*tal)/i`
- Determina el nivel de contexto y devuelve el menú correspondiente

**b) Interceptor numérico en idle** (antes de NLU):
- Si estado es `idle` y mensaje es un número, mapear al menú activo:
  - Nivel 1: 1=ver_locales, 2=buscar, 3=horarios, 4=ayuda
  - Nivel 2: 1=ver_menu, 2=ver_carrito, 3=confirmar, 4=hablar_vendedor, 5=ver_locales, 6=ayuda
  - Nivel 3: 1=estado, 2=cancelar, 3=vendedor, 4=calificar, 5=horarios, 6=ayuda
  - Nivel 4: 1=calificar, 2=ver_locales, 3=buscar, 4=ayuda

### 3. `nlu.ts` — Agregar intent `greeting`

Agregar `"greeting"` al tipo `Intent` y al prompt de clasificación para que saludos no capturados por regex se clasifiquen correctamente.

### 4. `state-machine.ts` — Handler `greeting` + idle fallback

- Agregar `"greeting"` a `VALID_INTENTS_BY_STATE` en todos los estados
- Handler `greeting`: determina nivel de contexto y devuelve menú correspondiente
- `handleInvalidIntent` en estado `idle`: devuelve menú principal (Nivel 1) en vez de error genérico
- Actualizar `STEP_HINTS.idle` para referenciar el menú numerado

### 5. Función helper: `getContextLevel(context)`

Función compartida que determina el nivel (1-4) según:
- `pending_order_id` + estado `order_completed` → Nivel 4
- `pending_order_id` + estados pending/confirmed → Nivel 3
- `selected_vendor_id` → Nivel 2
- Default → Nivel 1

Usada tanto por el interceptor de saludos como por el handler de `greeting` en la state machine.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `i18n.ts` | 5 nuevas keys en 4 idiomas |
| `vendor-bot.ts` | Interceptor saludos + interceptor números contextual |
| `nlu.ts` | Agregar `greeting` al tipo y prompt |
| `state-machine.ts` | Handler greeting, idle fallback → menú, `getContextLevel()`, STEP_HINTS |

