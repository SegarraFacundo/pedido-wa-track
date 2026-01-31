

# Plan: Corregir Lógica de Retiro en Local

## Resumen

Modificar el prompt para que el bot **NO pregunte sobre retiro en local** cuando el negocio no tiene esa opción habilitada.

---

## Cambio Único

### Archivo: `supabase/functions/evolution-webhook/simplified-prompt.ts`

**Líneas 164-170 - Reemplazar:**

```text
🏪 RETIRO EN LOCAL vs DELIVERY:
- Si vendor acepta retiro (context.vendor_allows_pickup = true):
  → Preguntá: "¿Querés que te lo enviemos o lo retirás en el local?"
  → Si elige "retiro" → usar seleccionar_tipo_entrega con tipo="pickup"
  → Si elige "delivery" → usar seleccionar_tipo_entrega con tipo="delivery"
- Si vendor NO acepta retiro:
  → Automáticamente asumir delivery y pedir dirección
```

**Con:**

```text
🏪 RETIRO EN LOCAL vs DELIVERY:
⚠️ IMPORTANTE: Verificá que context.vendor_allows_pickup corresponde al vendor actual
- Si context.vendor_allows_pickup = true Y context.vendor_allows_delivery = true (o no está definido):
  → Preguntá: "¿Querés que te lo enviemos o lo retirás en el local?"
  → Si elige "retiro" → usar seleccionar_tipo_entrega con tipo="pickup"
  → Si elige "delivery" → usar seleccionar_tipo_entrega con tipo="delivery"
- Si context.vendor_allows_pickup = false (o no está definido):
  → NO preguntes sobre retiro, asumí delivery directamente
  → Pedí la dirección de entrega sin ofrecer la opción de retiro
- Si context.vendor_allows_delivery = false:
  → NO preguntes sobre delivery, asumí retiro directamente
  → NO pidas dirección
```

---

## Resultado Esperado

| Configuración del Negocio | Comportamiento Anterior | Comportamiento Nuevo |
|--------------------------|------------------------|---------------------|
| Solo delivery | A veces preguntaba sobre retiro | Pide dirección directamente |
| Solo retiro | Podía preguntar opciones | Asume retiro, no pide dirección |
| Ambos habilitados | Preguntaba correctamente | Sin cambios |

---

## Impacto

- **Archivos:** 1
- **Líneas:** ~10
- **Riesgo:** Bajo
- **Deploy:** Sí (edge function `evolution-webhook`)

