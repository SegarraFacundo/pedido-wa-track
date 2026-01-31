

# Plan: Corregir Chat en Tiempo Real y Mensajes de Bot

## Problemas Identificados

### Problema 1: Mensajes del cliente no aparecen en tiempo real
El cliente escribió "hola" pero no se ve en el panel del vendedor.

**Causa**: El webhook inserta mensajes del cliente en la tabla `messages`, y hay suscripción realtime configurada, pero podría haber un problema con el filtro o el orden de llegada.

### Problema 2: Falta notificación de "bot desactivado"
Cuando el vendedor envía un mensaje, el cliente solo recibe el mensaje pero no sabe que el bot fue pausado.

**Solución**: Agregar un mensaje inicial cuando el vendedor envía por primera vez: "⚠️ El vendedor va a responderte personalmente. El bot está pausado."

### Problema 3: Mensaje de reactivación con texto innecesario
Actualmente: `'✅ El asistente virtual está activo nuevamente. Escribe "menu" para ver opciones.'`

El usuario no quiere la parte de "Escribe 'menu'..."

---

## Cambios Necesarios

### 1. Mejorar flujo de mensajes cuando el bot se pausa

**Archivo:** `src/hooks/useRealtimeMessages.ts`
**Líneas 175-197**

Cuando el vendedor envía el primer mensaje (y el bot no está pausado aún):
1. Enviar primero: "⚠️ *{vendorName}* va a responderte personalmente. El bot está pausado."
2. Luego enviar el mensaje del vendedor

```typescript
// Antes del mensaje del vendedor, si el bot NO estaba pausado, notificar
if (!isBotPaused) {
  await supabase.functions.invoke('send-whatsapp-notification', {
    body: {
      phoneNumber: orderData.customer_phone,
      message: `⚠️ *${vendorName}* va a responderte personalmente.\n\n🤖 El bot está pausado hasta que el vendedor lo reactive.`
    }
  });
}

// Luego el mensaje normal del vendedor
await supabase.functions.invoke('send-whatsapp-notification', {
  body: {
    orderId,
    phoneNumber: orderData.customer_phone,
    message: `📩 *${vendorName}*: ${content}`
  }
});
```

### 2. Simplificar mensaje de reactivación del bot

**Archivo:** `src/hooks/useRealtimeMessages.ts`
**Línea 59**

Cambiar:
```typescript
message: '✅ El asistente virtual está activo nuevamente. Escribe "menu" para ver opciones.'
```

Por:
```typescript
message: '✅ El asistente virtual está activo nuevamente.'
```

**Archivo:** `src/components/VendorDirectChat.tsx`
**Línea 304**

Cambiar:
```typescript
message: `✅ El vendedor cerró el chat directo.\n\n🤖 El bot está activo nuevamente.\n\nEscribe "menu" para ver las opciones.`
```

Por:
```typescript
message: `✅ El bot está activo nuevamente.`
```

### 3. Verificar realtime de mensajes del cliente

**Archivo:** `src/hooks/useRealtimeMessages.ts`
**Líneas 99-133**

El código actual tiene la suscripción correcta, pero necesito verificar que esté funcionando:

```typescript
.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `order_id=eq.${orderId}`
  },
  (payload) => {
    // Este callback debería dispararse cuando llega un mensaje
  }
)
```

**Posible problema**: El filtro RLS podría estar bloqueando la lectura en tiempo real. Verificar políticas RLS de la tabla `messages`.

---

## Flujo Corregido

```text
1. Cliente tiene pedido activo
2. Vendedor abre el chat y escribe un mensaje

   → [NUEVO] Cliente recibe: "⚠️ El vendedor va a responderte. Bot pausado."
   → Cliente recibe: "📩 Vendedor: [mensaje]"
   
3. Cliente responde "hola"
   → Webhook guarda en tabla messages
   → Realtime notifica al panel del vendedor
   → [A VERIFICAR] Mensaje aparece en el chat

4. Vendedor reactiva el bot
   → [SIMPLIFICADO] Cliente recibe: "✅ El asistente virtual está activo."
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useRealtimeMessages.ts` | Agregar notificación de bot pausado + simplificar reactivación |
| `src/components/VendorDirectChat.tsx` | Simplificar mensaje de reactivación |

---

## Sección Técnica

### Verificación de Realtime
Para depurar si los mensajes llegan, agregaré logs adicionales en el callback de realtime para confirmar que la suscripción está activa.

### Secuencia de Mensajes WhatsApp
Cuando el vendedor envía su primer mensaje:
1. **Primer mensaje**: Notificación de bot pausado (solo si `!isBotPaused`)
2. **Segundo mensaje**: El contenido del mensaje del vendedor

Esto asegura que el cliente sepa que está hablando con una persona real.

### Edge Case: Mensajes Consecutivos
Si el vendedor envía múltiples mensajes, solo el primero debería notificar "bot pausado". Los siguientes solo envían el contenido porque `isBotPaused` ya será `true`.

