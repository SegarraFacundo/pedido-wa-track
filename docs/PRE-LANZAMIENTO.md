# ✅ Checklist pre-lanzamiento — Lapacho PWA

> Qué está listo y qué falta para abrir con **clientes reales**.
> Fecha: 2026-11-21.

---

## ✅ Ya está listo
- **Dominios + SSL + redirects**: `lapacho.ar` canónico; `www` y `pages.dev` redirigen ahí; HTTP→HTTPS.
- **Login con Google** (verificado de punta a punta).
- **Storefront**: tienda, buscador y categorías por negocio, destacados, promociones, abiertos primero.
- **Flujo de pedido**: carrito, checkout (entrega/retiro, datos, pago, resumen) y seguimiento en vivo.
- **Panel del vendedor**: pedidos en tiempo real, productos, ofertas, métricas, etc.
- **Landing** enfocada en la PWA.
- **Seguridad**: datos sensibles de negocios (alias/CBU, tokens) NO se exponen al cliente (vista `public_vendors`).

---

## ⚠️ Antes de abrir con clientes reales

### 1. Limpiar datos de prueba 🔴 (importante)
Hoy la base tiene datos de demo: **9 negocios**, **48 productos**, pedidos de prueba y cuentas demo (`admin@lapacho.ar`, `soporte1/2@lapacho.ar`, y los `*@lapacho.ar` de cada negocio — ver `CREDENCIALES-PRUEBA.md`).
- [ ] Decidir qué negocios/productos son reales y **borrar el resto**.
- [ ] Borrar los **pedidos de prueba**.
- [ ] Borrar/renombrar las **cuentas demo** (sobre todo `admin@lapacho.ar`, que es admin).
- [ ] Quitar el `is_featured` de demo (Burger House, Pizzería Don Luigi) y dejarlo para quien realmente pague.

### 2. MercadoPago 🟠
Cada negocio conecta **su propia** cuenta de MP (OAuth desde su panel → Pagos). Usa la API de producción.
- [x] ~~`APP_URL`~~ → **corregido a `https://lapacho.ar`** (estaba en `plataforma.lapacho.ar`, rompía el retorno del pago del cliente). `MP_REDIRECT_URI` y `MP_CLIENT_ID` OK.
- [ ] Que cada negocio real conecte su cuenta de MercadoPago.
- [ ] Probar un **pago real** de punta a punta (checkout → pago → webhook → estado del pedido actualizado).
- [ ] (Menor) El redirect post-conexión de MP del vendedor va a `/vendor`; la ruta real es `/vendor-dashboard` — revisar.

### 3. Login por email (SMTP) ✅ funciona (mejorar deliverability)
- [x] SMTP de Resend cargado y **probado**: el magic link llega y el login entra. Dominio `lapacho.ar` verificado en Resend (DKIM ✅), remitente `soporte@lapacho.ar`, rate limit 30/h.
- [ ] **Sale a spam** → mejorar deliverability:
  - [ ] Completar **Forge**: borrar el **MX viejo de Amazon SES** en `send.lapacho.ar` (`feedback-smtp.sa-east-1.amazonses.com`) para que el CNAME `send → send.forge.rmta.net` quede válido y el envío pase a la infra dedicada de Resend.
  - [ ] Agregar **SPF** en el dominio raíz `lapacho.ar` (no existe).
  - Con dominio nuevo, la reputación también mejora con el tiempo/uso.
- [ ] **Para producción (profesionalizar)**: cuenta de Resend propia de Lapacho (hoy se usa la compartida con Órbita) con subdominio de envío propio.
- Mientras tanto, **Google funciona 100%**.

### 4. Google OAuth 🟠
- [ ] Confirmar que la **pantalla de consentimiento esté publicada / "In production"** en Google Cloud (si está en "Testing", solo entran usuarios de prueba y muestra "app no verificada").

### 5. Notificaciones 🟡
- [ ] Probar **web-push real** (cliente activa permiso → el negocio cambia el estado → llega el aviso con la app cerrada). Las VAPID keys ya están.
- [ ] Confirmar que al negocio le **llegue el aviso de pedido nuevo** (realtime + sonido/push).

### 6. Contenido y configuración por negocio 🟡
- [ ] Cada negocio: **horarios reales**, **zona/costo de envío**, **métodos de pago** y productos con precio/stock.
- [ ] Revisar **/terminos** y **/privacidad** (que el texto sea el definitivo).

---

## 🗒️ Notas
- El estado general de la migración está en `docs/BITACORA-PWA.md`.
- Google OAuth no depende del dominio (el redirect va a Supabase), así que el cambio a lapacho.ar no lo afecta.
- Prioridad sugerida para abrir: **1 (limpiar datos) → 2 (MercadoPago + APP_URL) → 4 (Google en producción) → 3 (SMTP) → 5/6**.
