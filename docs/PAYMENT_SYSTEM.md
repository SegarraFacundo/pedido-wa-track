# Sistema de Configuración de Pagos

## Descripción

Sistema completo que permite a cada vendedor configurar sus propios medios de pago: MercadoPago (con OAuth), Transferencia bancaria y Efectivo.

## Funcionalidades

### 1. Panel de Configuración de Pagos (Vendedores)

Los vendedores pueden acceder a la pestaña **💰 Pagos** en su dashboard para configurar:

#### MercadoPago
- **Conexión OAuth**: Conecta tu cuenta de MercadoPago de forma segura
- **Tokens automáticos**: El sistema guarda y renueva automáticamente los tokens de acceso
- **Estado de conexión**: Visualiza si tu cuenta está conectada y cuándo expira el token

#### Transferencia Bancaria
- **Datos bancarios**: Configura tu alias, CBU/CVU y titular de cuenta
- **Toggle de activación**: Activa/desactiva este medio de pago cuando quieras

#### Efectivo
- **Toggle simple**: Activa/desactiva pagos en efectivo al momento de la entrega

### 2. Edge Functions Implementadas

#### `get-mercadopago-auth-url`
Genera la URL de autorización de MercadoPago de forma segura.

**Endpoint**: `POST /functions/v1/get-mercadopago-auth-url`

**Body**:
```json
{
  "vendorId": "uuid-del-vendedor",
  "redirectUri": "https://tu-dominio.com/vendor"
}
```

**Response**:
```json
{
  "auth_url": "https://auth.mercadopago.com/authorization?..."
}
```

#### `mercadopago-oauth-callback`
Recibe el callback de OAuth de MercadoPago y guarda los tokens.

**Endpoint**: `GET /functions/v1/mercadopago-oauth-callback?code=xxx&state=vendor_id`

**Qué hace**:
1. Intercambia el código de autorización por tokens de acceso
2. Calcula la fecha de expiración (6 meses)
3. Guarda los tokens en la configuración del vendedor
4. Redirige al dashboard con mensaje de éxito

#### `generate-payment-link`
Genera un link de pago según los métodos configurados por el vendedor.

**Endpoint**: `POST /functions/v1/generate-payment-link`

**Body**:
```json
{
  "orderId": "uuid-del-pedido"
}
```

**Response** (MercadoPago disponible):
```json
{
  "success": true,
  "method": "mercadopago",
  "payment_link": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=xxx",
  "preference_id": "xxx-xxx"
}
```

**Response** (Solo transferencia/efectivo):
```json
{
  "success": true,
  "available_methods": [
    {
      "method": "transferencia",
      "details": {
        "alias": "mi.negocio.mp",
        "cbu": "0000003100010000000000",
        "titular": "Juan Pérez",
        "amount": 15000
      }
    },
    {
      "method": "efectivo",
      "details": {
        "amount": 15000,
        "message": "Pago en efectivo al recibir el pedido"
      }
    }
  ]
}
```

#### `mercadopago-webhook`
Recibe notificaciones de MercadoPago sobre pagos.

**Endpoint**: `POST /functions/v1/mercadopago-webhook`

**Body** (enviado por MercadoPago):
```json
{
  "type": "payment",
  "data": {
    "id": "payment-id"
  }
}
```

**Nota**: Este webhook debe ser configurado en la aplicación de MercadoPago.

#### `refresh-mercadopago-tokens`
Job programado que renueva los tokens de MercadoPago cada 24 horas.

**Endpoint**: Se ejecuta automáticamente (configurar con pg_cron)

**Qué hace**:
1. Busca todos los vendedores con MercadoPago conectado
2. Usa el refresh_token para obtener nuevos tokens
3. Actualiza la configuración de cada vendedor
4. Registra el resultado en `mercadopago_token_refresh_log`

## Estructura de Datos

### Campo `payment_settings` en tabla `vendors`

```json
{
  "efectivo": true,
  "transferencia": {
    "activo": false,
    "alias": "mi.negocio.mp",
    "cbu": "0000003100010000000000",
    "titular": "Juan Pérez"
  },
  "mercadoPago": {
    "activo": true,
    "user_id": "123456789",
    "access_token": "APP_USR-xxx-xxx",
    "refresh_token": "TG-xxx-xxx",
    "fecha_expiracion_token": "2025-06-15T12:00:00Z"
  }
}
```

### Tabla `mercadopago_token_refresh_log`

Registra cada intento de renovación de tokens:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | ID único del log |
| vendor_id | UUID | Referencia al vendedor |
| refreshed_at | TIMESTAMP | Cuándo se intentó renovar |
| success | BOOLEAN | Si fue exitoso |
| error_message | TEXT | Mensaje de error (si falló) |

## Configuración Necesaria

### 1. Secrets de Supabase

Debes configurar estos secrets en tu proyecto:

- `MP_CLIENT_ID`: Client ID de tu aplicación de MercadoPago
- `MP_CLIENT_SECRET`: Client Secret de tu aplicación de MercadoPago
- `MP_REDIRECT_URI`: URL de callback OAuth (ej: `https://tu-proyecto.supabase.co/functions/v1/mercadopago-oauth-callback`)

### 2. Configurar pg_cron para renovación automática

Ejecuta en el SQL Editor de Supabase:

```sql
-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Programar job de renovación diaria (a las 3 AM)
SELECT cron.schedule(
  'refresh-mercadopago-tokens-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://ilhpiarkmwdjvrfqhyhi.supabase.co/functions/v1/refresh-mercadopago-tokens',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);

-- Ver jobs programados
SELECT * FROM cron.job;

-- Ver historial de ejecuciones
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### 3. Configurar Webhook en MercadoPago

1. Ir a tu aplicación en [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
2. En "Webhooks", agregar:
   - **URL**: `https://tu-proyecto.supabase.co/functions/v1/mercadopago-webhook`
   - **Eventos**: `payment`

## Integración con el Bot de WhatsApp

### Ejemplo de uso en `vendor-bot.ts`

```typescript
// Cuando el cliente confirma el pedido y necesita pagar
async function handlePaymentRequest(orderId: string) {
  const { data, error } = await supabase.functions.invoke('generate-payment-link', {
    body: { orderId }
  });

  if (error) {
    console.error('Error generating payment link:', error);
    return 'Hubo un error al generar el link de pago. Por favor intenta nuevamente.';
  }

  if (data.method === 'mercadopago') {
    return `¡Perfecto! Puedes pagar tu pedido aquí: ${data.payment_link}\n\nUna vez que completes el pago, tu pedido será procesado automáticamente.`;
  }

  // Si no hay MercadoPago, ofrecer alternativas
  let message = '📋 *Métodos de pago disponibles:*\n\n';

  for (const method of data.available_methods) {
    if (method.method === 'transferencia') {
      message += `💳 *Transferencia Bancaria*\n`;
      message += `Alias: ${method.details.alias}\n`;
      message += `CBU/CVU: ${method.details.cbu}\n`;
      message += `Titular: ${method.details.titular}\n`;
      message += `Monto: $${method.details.amount}\n\n`;
      message += `Envianos el comprobante cuando realices la transferencia.\n\n`;
    }

    if (method.method === 'efectivo') {
      message += `💵 *Efectivo*\n`;
      message += `Monto: $${method.details.amount}\n`;
      message += `${method.details.message}\n`;
    }
  }

  return message;
}
```

## Flujo Completo

### 1. Vendedor configura medios de pago

1. Vendedor accede a su dashboard → pestaña **Pagos**
2. Conecta MercadoPago (OAuth automático)
3. Configura transferencia bancaria
4. Activa/desactiva efectivo

### 2. Cliente realiza un pedido

1. Cliente habla con el bot de WhatsApp
2. Selecciona productos y confirma pedido
3. Bot llama a `generate-payment-link` con el orderId
4. Bot envía al cliente:
   - Link de MercadoPago (si disponible)
   - Datos de transferencia (si está configurada)
   - Opción de efectivo (si está activa)

### 3. Sistema procesa el pago

**MercadoPago:**
- Cliente paga a través del link
- MercadoPago envía webhook a tu sistema
- Sistema actualiza el estado del pedido
- Sistema notifica al vendedor

**Transferencia:**
- Cliente realiza la transferencia
- Cliente envía comprobante por WhatsApp
- Vendedor confirma el pago en su dashboard
- Sistema actualiza el estado del pedido

**Efectivo:**
- Vendedor confirma el pago al entregar
- Sistema actualiza el estado del pedido

## Notas de Seguridad

1. **Tokens sensibles**: Los access_token y refresh_token de MercadoPago se guardan en la base de datos. Asegúrate de que las RLS policies estén correctamente configuradas.

2. **Webhooks**: El webhook de MercadoPago está público (sin JWT), pero MercadoPago firma las notificaciones. En producción, deberías verificar la firma.

3. **OAuth flow**: El state parameter contiene el vendor_id para asociar la autorización con el vendedor correcto.

4. **Renovación de tokens**: Los tokens se renuevan automáticamente cada 24 horas. Si un token expira, el vendedor debe reconectar su cuenta.

## Monitoreo

Para verificar el estado de los tokens:

```sql
-- Ver vendedores con MercadoPago conectado
SELECT 
  v.id,
  v.name,
  v.payment_settings->'mercadoPago'->>'activo' as mp_activo,
  v.payment_settings->'mercadoPago'->>'fecha_expiracion_token' as expiration
FROM vendors v
WHERE v.payment_settings->'mercadoPago'->>'activo' = 'true';

-- Ver log de renovaciones recientes
SELECT * FROM mercadopago_token_refresh_log
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Error: "No se pudo iniciar la conexión con MercadoPago"
- Verificar que los secrets MP_CLIENT_ID y MP_CLIENT_SECRET estén configurados
- Revisar logs en Edge Function `get-mercadopago-auth-url`

### Error: "Failed to exchange code for tokens"
- Verificar que el MP_REDIRECT_URI coincida con el configurado en MercadoPago
- Revisar que el código no haya expirado (son de un solo uso)
- Logs en Edge Function `mercadopago-oauth-callback`

### Tokens no se renuevan automáticamente
- Verificar que pg_cron esté instalado y el job programado
- Revisar logs en `mercadopago_token_refresh_log`
- Ejecutar manualmente: `SELECT net.http_post(...)`

### Webhook de MercadoPago no funciona
- Verificar que la URL esté correctamente configurada en MercadoPago
- Revisar logs de Edge Function `mercadopago-webhook`
- MercadoPago reintenta varias veces si hay error
