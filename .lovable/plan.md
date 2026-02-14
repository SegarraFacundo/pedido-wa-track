

# Plan: Flujo de cancelacion con captura de motivo programatica

## Problema actual

Cuando el bot pide el motivo de cancelacion y el usuario responde (ej: "Quiero pedir otra cosa"), el mensaje es interceptado por el bloqueo de `newOrderKeywords` porque contiene "quiero pedir". El motivo nunca llega al LLM.

Ademas, el flujo actual depende 100% del LLM para manejar la cancelacion, lo que es fragil.

## Solucion

Agregar un estado `pending_cancellation` al contexto (similar a `pending_vendor_change`). Cuando el usuario pide cancelar, se activa este flag. El siguiente mensaje del usuario se captura como motivo sin importar su contenido, y luego se pide confirmacion antes de ejecutar `cancelar_pedido`.

## Flujo propuesto

```text
Usuario: "Quiero cancelar el pedido"
  Bot: "¿Por que queres cancelar? Escribi el motivo:"
  (Se activa pending_cancellation = { step: "awaiting_reason" })

Usuario: "Quiero pedir otra cosa"  <-- Ahora se captura sin filtros
  Bot: "Vas a cancelar el pedido #abc123. Motivo: 'Quiero pedir otra cosa'. Confirmas? (si/no)"
  (Se guarda pending_cancellation = { step: "awaiting_confirmation", reason: "Quiero pedir otra cosa" })

Usuario: "si"
  Bot ejecuta cancelar_pedido con el motivo guardado
```

## Cambios tecnicos

### 1. Archivo: `supabase/functions/evolution-webhook/types.ts`

Agregar campo `pending_cancellation` a `ConversationContext`:

```typescript
pending_cancellation?: {
  step: "awaiting_reason" | "awaiting_confirmation";
  reason?: string;
  order_id?: string;
};
```

### 2. Archivo: `supabase/functions/evolution-webhook/context.ts`

Persistir y cargar `pending_cancellation` del contexto guardado. Limpiarlo cuando se resetea el contexto (en `syncOrderStateWithDB`).

### 3. Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`

Agregar un bloque programatico (como `pending_vendor_change` y `resumen_mostrado`) que intercepte mensajes cuando `pending_cancellation` esta activo:

**Paso 1 - awaiting_reason**: Capturar lo que sea que el usuario escriba como motivo (sin filtros de keywords). Guardar en `pending_cancellation.reason` y pedir confirmacion.

**Paso 2 - awaiting_confirmation**: Si dice "si/dale/ok", ejecutar `cancelar_pedido` con el motivo guardado. Si dice "no", cancelar la cancelacion y seguir con el flujo normal.

Ademas, cuando el LLM detecte intencion de cancelar (o la herramienta `cancelar_pedido` se llame sin motivo), en vez de devolver "proporciona un motivo", setear `pending_cancellation = { step: "awaiting_reason" }` y preguntar el motivo.

### 4. Despliegue

Redesplegar `evolution-webhook`.

## Archivos modificados
- `supabase/functions/evolution-webhook/types.ts` (nuevo campo en interfaz)
- `supabase/functions/evolution-webhook/context.ts` (persistir nuevo campo)
- `supabase/functions/evolution-webhook/vendor-bot.ts` (bloque programatico + ajuste en cancelar_pedido)
