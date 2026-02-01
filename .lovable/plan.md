

# Plan: Mejorar Flujo de Escape del Chat con Vendedor

## Resumen del Problema

Cuando el cliente tiene un **pedido activo** y está en chat directo con el vendedor:
- Si el vendedor no reactiva el bot, el cliente queda "atrapado"
- Si el cliente escribe "menu", el bot se reactiva pero no le dice qué puede hacer
- El cliente piensa que está "bloqueado" porque no puede ver locales ni menús

**Solución**: Cuando el cliente sale del chat con vendedor Y tiene pedido activo, mostrar un menú contextual con las opciones disponibles.

---

## Cambios Propuestos

### 1. Mensaje de Escape Mejorado (cuando el bot se reactiva)

**Archivo:** `supabase/functions/evolution-webhook/index.ts`
**Líneas:** ~878-889

Cuando el cliente escribe "menu" o "bot" para reactivar el bot, verificar si tiene pedido activo y mostrar opciones relevantes:

```typescript
if (vendorSession?.in_vendor_chat && isReactivateCommand) {
  // Desactivar chat directo
  await supabase.from('user_sessions').update({ ... });
  
  // NUEVO: Verificar si tiene pedido activo
  const { data: activeOrder } = await supabase
    .from('orders')
    .select('id, status, vendor_id, vendors(name)')
    .eq('customer_phone', normalizedPhone)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (activeOrder) {
    // Enviar mensaje con opciones para pedido activo
    await sendWhatsAppMessage(chatId, 
      `✅ El bot está activo nuevamente.\n\n` +
      `📦 Tenés un pedido activo (#${activeOrder.id.substring(0,8)}).\n\n` +
      `¿Qué querés hacer?\n` +
      `• Escribí *"estado"* para ver el estado del pedido\n` +
      `• Escribí *"cancelar"* si querés cancelar el pedido\n` +
      `• Escribí *"hablar vendedor"* para volver a hablar con ${activeOrder.vendors?.name}`
    );
    
    // NO continuar con procesamiento del bot, ya enviamos respuesta
    return Response...
  }
}
```

### 2. Timeout Automático (30 minutos)

**Archivo:** `supabase/functions/evolution-webhook/index.ts`
**Líneas:** ~867-873

Antes de procesar el modo chat con vendedor, verificar timeout:

```typescript
const { data: vendorSession } = await supabase
  .from('user_sessions')
  .select('in_vendor_chat, assigned_vendor_phone, updated_at')
  .eq('phone', normalizedPhone)
  .maybeSingle();

// NUEVO: Verificar timeout de 30 minutos
if (vendorSession?.in_vendor_chat && vendorSession.updated_at) {
  const lastActivity = new Date(vendorSession.updated_at).getTime();
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;
  
  if (now - lastActivity > THIRTY_MINUTES) {
    // Auto-reactivar el bot
    await supabase.from('user_sessions').update({
      in_vendor_chat: false,
      assigned_vendor_phone: null
    }).eq('phone', normalizedPhone);
    
    await sendWhatsAppMessage(chatId,
      `⏰ El chat con el vendedor expiró por inactividad.\n\n` +
      `✅ El bot está activo. ¿En qué te puedo ayudar?`
    );
    
    // Continuar procesamiento normal
  }
}
```

### 3. Mensaje de Pausa con Instrucciones

**Archivo:** `src/hooks/useRealtimeMessages.ts`
**Línea:** ~160

Cuando el vendedor pausa el bot, informar cómo escapar:

```typescript
message: `⚠️ *${vendorName}* va a responderte personalmente.\n\n🤖 El bot está pausado.\n\n_Escribí *"menu"* para volver al bot._`
```

### 4. Agregar Comandos de Escape

**Archivo:** `supabase/functions/evolution-webhook/index.ts`
**Línea:** ~875

Ampliar la lista de comandos que reactivan el bot:

```typescript
const clientBotCommands = [
  'menu', 'bot', 'ayuda', 'salir', 'inicio', 'volver',
  'estado', 'mi pedido', 'cancelar', 'nuevo pedido'
];
```

---

## Flujo Actualizado

```text
┌─────────────────────────────────────────────────────────────┐
│         CLIENTE CON PEDIDO ACTIVO EN CHAT VENDEDOR          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vendedor envía mensaje →                                   │
│  "⚠️ Vendedor va a responderte. Bot pausado.               │
│   Escribí 'menu' para volver al bot."                       │
│                                                             │
│  ┌──────────────────┐         ┌────────────────────┐       │
│  │ OPCIÓN 1         │         │ OPCIÓN 2           │       │
│  │ Cliente escribe  │         │ 30 min sin         │       │
│  │ "menu"/"estado"  │         │ actividad          │       │
│  └────────┬─────────┘         └──────────┬─────────┘       │
│           │                              │                  │
│           └──────────┬───────────────────┘                  │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ ✅ Bot activo. Tenés pedido #abc123.             │      │
│  │                                                  │      │
│  │ ¿Qué querés hacer?                               │      │
│  │ • "estado" → ver estado                          │      │
│  │ • "cancelar" → cancelar pedido                   │      │
│  │ • "hablar vendedor" → volver al chat             │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/evolution-webhook/index.ts` | Mensaje contextual al reactivar + timeout automático + más comandos |
| `src/hooks/useRealtimeMessages.ts` | Instrucción de escape en mensaje de pausa |

---

## Resumen

| Mejora | Descripción |
|--------|-------------|
| Mensaje de escape | El cliente sabe cómo volver al bot |
| Menú contextual | Al volver, ve sus opciones (estado/cancelar/hablar) |
| Timeout automático | Si nadie habla en 30 min, bot se reactiva solo |
| Más comandos | "estado", "cancelar", "mi pedido" también reactivan el bot |

Esto asegura que el cliente **nunca quede atrapado** y siempre sepa qué puede hacer.

