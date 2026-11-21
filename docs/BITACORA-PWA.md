# Bitácora — Migración a PWA (Lapacho)

> Estado del paso de Lapacho de bot de WhatsApp a PWA de cliente.
> Última actualización: **2026-11-20**.

---

## ✅ Hecho

### Infraestructura / Deploy
- Proyecto fuera de Lovable; front en **Cloudflare Pages** (proyecto `pedido-wa-track`), repo `SegarraFacundo/pedido-wa-track`.
- **DNS migrado a Cloudflare** (nameservers `hattie`/`will.ns.cloudflare.com`).
- **5 dominios conectados a Pages**, todos con SSL activo (HTTPS 200):
  `lapacho.ar`, `www.lapacho.ar`, `admin.lapacho.ar`, `soporte.lapacho.ar`, `plataforma.lapacho.ar`.
- Apps reales intactas (DNS-only): `evolution.lapacho.ar`, `gestion-turnos-hospital.lapacho.ar`.
- **Video del hero** comprimido 64 MB → 1,5 MB (1280px, sin audio) y sirviéndose en vivo.

### Auth / Cuentas
- **Login con Google** verificado de punta a punta.
- **Login obligatorio del cliente**: se eliminó el modo invitado; toda orden queda atada a una cuenta real.
- **Login por email (magic link)** además de Google, para quien no tiene Google.
- Supabase: `Site URL = https://lapacho.ar` + redirect URLs `lapacho.ar/**` y `*.lapacho.ar/**`.
- **Cuentas de prueba** (admin, 2 soporte, 9 negocios) en `CREDENCIALES-PRUEBA.md` (ignorado por git).

### Storefront del cliente
- **Buscador + categorías dentro de cada negocio** (patrón apps de delivery: menú agrupado por categoría, barra de chips sticky con scroll-spy, buscador que filtra).
- **Links legibles por negocio** con slug: `/tienda/pizzeria-don-luigi` (los links por uuid siguen funcionando).
- **Home**: sección **Destacados** (negocios que pagan), sección **Promociones** (ofertas/descuentos activos), y negocios **abiertos primero**.

---

## ⏳ Pendiente

### Landing page (próximo paso grande)
Rediseñarla porque **el bot de WhatsApp ya no existe**: todo va a la PWA.
- Quitar el discurso de "pedí por WhatsApp" y apuntar a la tienda online / PWA.
- Branding + buenas prácticas de UX/UI para plataformas tipo marketplace de delivery.
- Sección de **ventajas de usar Lapacho**:
  - Por qué conviene **como cliente**.
  - Por qué conviene **sumarse como negocio**.
- CTAs claros: entrar a la tienda / registrar mi negocio.

### Auth / producción
- **SMTP propio (Resend/SES)** para que el login por email entregue los mails de verdad (el default de Supabase manda ~2/h y cae en spam).
- Google OAuth: confirmar que la pantalla de consentimiento esté **publicada** (producción). *(El redirect de Google apunta a Supabase, así que el cambio de dominio NO requiere tocar Google.)*

### Features / pulido
- Feedback de un usuario: **"que esté todo alineado a la derecha"** → falta captura para entender a qué pantalla se refiere.
- **Web-push real**: probar la entrega de notificaciones con la app cerrada (ya está construido).
- (Opcional) Link directo en raíz `lapacho.ar/pizzeria-don-luigi` (sin `/tienda`).

### Pre-lanzamiento
- **Borrar los datos de prueba** antes de abrir con clientes reales.
- Revisar **MercadoPago** (credenciales test vs producción).
- Confirmar que los dominios sigan en Active.

---

## 🗒️ Notas técnicas
- **Destacados**: columna `vendors.is_featured` (la activa el admin según quién pague). Hoy hay 2 marcados de demo.
- **Slug**: columna `vendors.slug` con trigger que la genera sola para negocios nuevos.
- **Categorías de productos**: venían con formato inconsistente (`["Bebidas"]` vs `[["Pizzas"]]`); se normaliza al leer.
