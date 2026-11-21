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
- [x] ~~(Menor) El redirect post-conexión de MP del vendedor iba a `/vendor` (ruta inexistente → 404 al recargar)~~ → corregido a `/vendor-dashboard` en front (`VendorDashboard.tsx`, `VendorPaymentSettings.tsx`, ya en main) y en la edge function `mercadopago-oauth-callback` (editada; **falta redeployar** la function — bloqueado pide confirmación).

### 3. Login por email (SMTP) ✅ funciona (mejorar deliverability)
- [x] SMTP de Resend cargado y **probado**: el magic link llega y el login entra. Dominio `lapacho.ar` verificado en Resend (DKIM ✅), remitente `soporte@lapacho.ar`, rate limit 30/h.
- [x] **Deliverability**: se limpió el DKIM duplicado y se borraron el MX/TXT viejos de SES en `send.lapacho.ar`. **Resend Forge = Ready** y dominio **Verified**. Forge enruta automáticamente a medida que el dominio gana reputación (warm-up). El spam debería irse con el uso.
- [x] **Template del Magic Link** en español + branding (header rosa, botón, slogan). Probado: **llega a Recibidos (no spam)**.
- [x] **Todos los templates de Auth** en español + branding (magic link, confirmar cuenta, restablecer contraseña, invitación, cambio de email, reautenticación).
- [ ] Mejoras opcionales:
  - [ ] Agregar **SPF** en el dominio raíz `lapacho.ar` (secundario; el DKIM ya alinea DMARC).
  - [ ] (Opcional) subdominio de **tracking** en Resend.
  - [x] ~~Agregar el **logo** (hoja) al header de los emails~~ → **hecho**: header blanco con borde rosa y el logo (`https://lapacho.ar/email-logo.png`) en los 6 templates de Auth. El preview de Supabase no muestra la imagen (CSP del iframe), pero en los clientes de correo reales carga.
- [ ] **Para producción (profesionalizar)**: cuenta de Resend propia de Lapacho (hoy se usa la compartida con Órbita) con subdominio de envío propio.
- Mientras tanto, **Google funciona 100%**.

### 4. Google OAuth ✅
- [x] ~~Confirmar que la **pantalla de consentimiento esté publicada / "In production"**~~ → **hecho**: proyecto `Lapacho` en Google Cloud, OAuth **publicado "En producción"**. Cualquier cuenta de Google puede entrar, sin "app no verificada" (scopes básicos → no requiere verificación). Se completó la marca (nombre, emails, links a lapacho.ar/privacidad/terminos) y los dominios autorizados (lapacho.ar + supabase.co). **No subir logo** al consent screen (gatilla verificación).

### 5. Notificaciones 🟡
- [x] ~~Probar **web-push real**~~ → **funciona** (el cliente recibe el aviso del pedido). Se corrigió el **ícono** de la notificación: salía un cuadrado blanco (`/favicon.ico`); ahora es la **hoja** (`/lapacho-icon.png`) tanto en el default del SW (bump a cache `v4`) como en el payload de `send-push`. Para verlo, el SW se actualiza al recargar la PWA. **Falta redeployar `send-push`** (opcional; el fix del SW ya alcanza).
- [ ] Confirmar que al negocio le **llegue el aviso de pedido nuevo** (el aviso al negocio va por **WhatsApp** vía `notify-vendor` + realtime/sonido en el panel; el web-push es solo para el cliente).

### 6. Contenido y configuración por negocio 🟡
- [ ] Cada negocio: **horarios reales**, **zona/costo de envío**, **métodos de pago** y productos con precio/stock.
- [ ] Revisar **/terminos** y **/privacidad** (que el texto sea el definitivo).

### 7. Equipo y sociedad 🟡
- [ ] Definir roles, ritmo de trabajo y formalizar la sociedad (SAS, acuerdo de socios, vesting, cesión de PI). Ver `docs/ROLES-Y-RITMO.md`.

---

## 🗒️ Notas
- **Fix (2026-11-21)**: loop infinito de redirección en `soporte.lapacho.ar` — `SubdomainRouter` no permitía `/soporte-auth`, así que rebotaba `/soporte` ↔ `/soporte-auth`. Corregido y verificado en vivo.
- El estado general de la migración está en `docs/BITACORA-PWA.md`.
- Google OAuth no depende del dominio (el redirect va a Supabase), así que el cambio a lapacho.ar no lo afecta.
- Prioridad sugerida para abrir: **1 (limpiar datos) → 2 (MercadoPago + APP_URL) → 4 (Google en producción) → 3 (SMTP) → 5/6**.
