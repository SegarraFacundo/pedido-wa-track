# Plan de implementación — Migración del cliente a PWA

> Estado: **borrador / diseño**. Última actualización: 2026-11-20.
> Lapacho pasa el canal del **cliente** de un bot de WhatsApp a una **PWA web** con UI de e-commerce.

---

## 1. Decisiones tomadas

- **Canal:** la PWA **reemplaza** a WhatsApp como canal de pedidos del cliente (no convivencia).
- **Experiencia:** **UI clásica de e-commerce** (catálogo → menú → carrito → checkout por pasos), no chat con IA.
- **Login del cliente:** **Google (OAuth, un toque)** como primario + **checkout como invitado** (anonymous sign-in). Se descartó teléfono+OTP (fricción de esperar/tipear código; SMS pago; WhatsApp vía Evolution es la misma tecnología no oficial que se deja; email OTP falla con buzones llenos). Google login no depende del correo ni del almacenamiento. El **teléfono se captura en el checkout** (se necesita para el delivery).
- **Datos:** el proyecto **no está en producción**; se **borra todo** antes de lanzar. No hay historial ni migración de datos que preservar.

Lo que NO cambia: vendedor, admin y soporte siguen con su web actual. El backend (Supabase + MercadoPago + facturación/comisiones) se conserva.

---

## 2. Qué ya existe y se reutiliza

| Pieza | Archivo | Uso en la PWA |
|---|---|---|
| Catálogo de negocios público | `src/components/VendorCatalog.tsx` | Base del Home (ya filtra por categoría y calcula abierto/cerrado) |
| Seguimiento de pedido (stepper) | `src/components/OrderTracking.tsx` | Pantalla "Mi pedido" (ojo: tiene un mapa con API key placeholder) |
| Chat genérico | `src/components/ChatInterface.tsx` | Chat cliente↔vendedor |
| Install prompt PWA | `src/components/PWAInstallPrompt.tsx` | Instalación de la app |
| Realtime | `src/hooks/useRealtimeOrders.ts`, `useRealtimeMessages.ts` | Estado de pedido y chat en vivo |
| i18n (es/en/pt/ja) | `src/i18n/` | Textos |
| UI kit | `src/components/ui/*` (shadcn) | Todo |
| Infra PWA | `public/sw.js`, `public/manifest-*.json`, `index.html` | Extender al rol cliente |

**La spec del recorrido ya está escrita**: las `tools` en `supabase/functions/evolution-webhook/tools-definitions.ts` y su lógica en `tool-handlers.ts` definen cada paso. La PWA replica ese flujo en pantallas.

---

## 3. Hechos del backend que condicionan el diseño

De `tool-handlers.ts` (handler `crear_pedido`, líneas ~794-1092):

- **Pedido** = insert en `orders` con: `vendor_id`, `customer_name`, `customer_phone`, `items` (el carrito como JSON), `total`, `status:"pending"`, `address`, `payment_method`, `delivery_type`, `coordinates`.
- **Carrito**: hoy **no es tabla**; vive en el JSON de contexto en `user_sessions.last_bot_message`, indexado por teléfono.
- **Costo de envío**: `vendors.delivery_fixed_price` (tarifa plana). Pickup = $0.
- **Métodos de pago reales por vendedor**: `vendors.payment_settings` → `{ efectivo: bool, transferencia: {activo, alias, cbu, titular}, mercadoPago: {activo} }`.
- **Stock**: `products.stock_enabled` + `products.stock_quantity`.
- **Pago MP**: edge function `generate-payment-link` con `{ orderId }` → `payment_link`.
- **Registro de pago**: tabla `order_payments` (`order_id`, `payment_method_name`, `amount`, `status`).
- **Aviso al vendedor**: edge function `notify-vendor` con `{ orderId, eventType:"new_order" }`.
- **Estados**: `pending → confirmed → preparing → ready → delivered` (+ `cancelled`).
- **RLS actual**: `products` es `SELECT` público ✅; `vendors` ya tiene vista "pública" sin datos sensibles; **`orders` NO tiene política para que el cliente cree/lea sus propios pedidos** (hoy los crea el bot con service-role). → Hay que agregarla.

---

## 4. Cambios estructurales necesarios (fundacionales)

### 4.1 Auth de cliente (Google + invitado)
- Activar en Supabase: **provider Google** (OAuth) + **Anonymous sign-ins**.
- Google Cloud: crear credenciales OAuth (client id/secret) y cargar el redirect de Supabase.
- `signInWithOAuth({ provider: 'google' })` para login; `signInAnonymously()` para invitado.
- El `auth.users.id` es la identidad (orders.user_id). El **teléfono se pide en el checkout**, no en el login.
- Un invitado puede luego vincular Google sin perder su carrito/pedido (misma sesión → `linkIdentity`).

### 4.2 Carrito materializado
- Nueva tabla `carts` (o `cart_items`) por usuario, o estado de cliente persistido (Zustand/localStorage + sync). Recomendado: **tabla `carts`** `{ user_id, vendor_id, items jsonb, updated_at }` (1 carrito activo por usuario, atado a un solo vendor como hoy).
- Reemplaza el carrito del contexto conversacional.

### 4.3 RLS de cliente
- `orders`: política `INSERT`/`SELECT` "el cliente ve y crea sólo sus pedidos" (`customer_phone = auth.jwt()->>'phone'` o `user_id`). Evaluar agregar `user_id uuid` a `orders` para atar por auth en vez de por teléfono string.
- `carts`: RLS dueño.
- `order_payments`, `order_status_history`, chat: `SELECT` del cliente dueño del pedido.
- `vendor_offers`, `vendor_hours`, `vendor_reviews`: `SELECT` público donde falte.

### 4.4 Extraer la lógica de negocio del bot a algo reutilizable
El problema: `tool-handlers.ts` mezcla reglas + contexto conversacional + envío por WhatsApp. Opciones:
- **(A) Edge functions "de dominio"** que la PWA llame directo: `crear-pedido`, `cotizar-envio`, `metodos-pago-vendedor`, `generar-link-pago` (ya existe). Server-side, service-role, validación fuerte. **Recomendado** para `crear_pedido` (valida stock, duplicados, método de pago, crea order+payment, notifica, genera MP).
- **(B) Acceso directo del front a tablas** con RLS para lo de sólo-lectura (catálogo, menú, ofertas, estado de pedido) → menos latencia, menos funciones.
- Regla práctica: **lecturas** → directo con RLS; **crear pedido y pagos** → edge function de dominio.

---

## 5. Fases

### Fase 0 — Fundaciones (sin UI nueva de pedido todavía)
- [ ] Phone Auth + OTP por Evolution (enviar código por WhatsApp).
- [ ] Tabla `carts` + RLS.
- [ ] RLS de cliente en `orders` / `order_payments` / chat.
- [ ] (Opcional) agregar `user_id` a `orders`.
- [ ] Edge function `crear-pedido` reusando la lógica de `tool-handlers.ts` (extraer, no duplicar).
- [ ] Edge functions/consultas: `metodos-pago-vendedor`, `cotizar-envio` (o leer `delivery_fixed_price`).

### Fase 1 — MVP de pedido (camino feliz)
- [ ] **Home cliente**: lista/búsqueda de negocios (basado en `VendorCatalog`) + estado abierto/cerrado.
- [ ] **Pantalla de negocio**: menú (productos por `vendor_id`, precio, stock) + horario + si acepta pickup.
- [ ] **Carrito**: agregar/quitar/cantidades, atado a un vendor, persistido en `carts`.
- [ ] **Checkout por pasos**: tipo de entrega (delivery/pickup) → dirección → método de pago (según `payment_settings`) → resumen → confirmar → `crear-pedido`.
- [ ] **Mi pedido**: `OrderTracking` con realtime (`useRealtimeOrders`).
- [ ] Rutas nuevas (`/tienda`, `/n/:vendorId`, `/carrito`, `/checkout`, `/pedido/:id`) dentro del esquema `/:locale/*`.

### Fase 2 — Paridad funcional con el bot
- [ ] **Pago MercadoPago**: redirección/retorno con `generate-payment-link` + `PaymentConfirmation` (ya existe la página).
- [ ] **Transferencia**: mostrar alias/CBU/titular desde `payment_settings`.
- [ ] **Ofertas** (`vendor_offers`).
- [ ] **Chat con vendedor** (`ChatInterface` + `hablar_con_vendedor` → `vendor_chats`/`chat_messages`).
- [ ] **Cancelar pedido** (con motivo).
- [ ] **Reseñas**: pedido (`registrar_calificacion`) y plataforma (`calificar_plataforma`).
- [ ] **Soporte**: crear ticket (`support_tickets`).
- [ ] **Notificaciones push** al cliente (extender `sw.js` + push al rol cliente).

### Fase 3 — PWA pulida + salida a prod
- [ ] `manifest-cliente.json` + `start_url` de cliente + icono/tema.
- [ ] Ajustar `index.html` (el switch de manifest por ruta) y `sw.js` (cache del catálogo, offline básico).
- [ ] Deep links e install prompt para cliente.
- [ ] Decidir destino del bot de WhatsApp (apagar webhook / dejar sólo soporte).
- [ ] **Limpieza de datos para producción** (borrar todo): ver checklist §7.

---

## 6. Riesgos / decisiones pendientes

- **OTP por WhatsApp**: Evolution sirve para enviar, pero valida bien el envío/rate-limit; tener SMS de respaldo.
- **Identidad por teléfono vs `user_id`**: hoy todo cuelga de `customer_phone` (string). Atar por `auth.users` es más robusto; decidir si se migra el modelo o se mapea por teléfono.
- **Mapa en `OrderTracking`**: usa Google Static Maps con API key placeholder; definir si se incluye o se saca.
- **Multi-vendor en un pedido**: hoy el modelo es 1 pedido = 1 vendor. Mantener esa regla en la PWA.
- **Moneda/locale**: en el bot hay mezcla de `es-PY` y `es-AR` al formatear montos; unificar.

---

## 7. Checklist de limpieza para producción (borrar todo)
- [ ] Vaciar `orders`, `order_payments`, `order_status_history`, `carts`, `user_sessions`, `chat_messages`/`vendor_chats`, `support_*`, `*_reviews`.
- [ ] Vaciar vendors/products de prueba (o dejar seed real).
- [ ] Revisar que no queden teléfonos/datos de prueba.
- [ ] Rotar credenciales si hiciera falta.

---

## 8. Próximo paso sugerido
Arrancar **Fase 0**: diseñar las migraciones (`carts` + RLS de `orders`) y el esqueleto de la edge function `crear-pedido` extrayendo la lógica de `tool-handlers.ts`.
