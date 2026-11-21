# 🗺️ Roadmap de features — Lapacho

> Qué le falta a Lapacho comparado con PedidosYa / Rappi / Uber Eats, priorizado por impacto y esfuerzo.
> Fecha: 2026-11-21. Relacionado: `docs/PRE-LANZAMIENTO.md` (qué falta para abrir) y `docs/BITACORA-PWA.md` (historial).
>
> Esfuerzo: 🟢 bajo · 🟡 medio · 🔴 alto

---

## ✅ Base que ya tenemos (no hace falta hacer)
- Marketplace multi-negocio, catálogo con **categorías, stock e imágenes**.
- **Login obligatorio** (Google + magic link) → pedidos atados a una cuenta real.
- Tienda: buscador, categorías, **destacados** (pagos), **promociones**, abiertos primero, links lindos por slug.
- Carrito (un negocio por vez), checkout (delivery/retiro), **seguimiento en vivo** (timeline de estados).
- Pagos: **MercadoPago** (OAuth por negocio) + **transferencia** + **efectivo**.
- Panel del vendedor completo: pedidos en tiempo real, productos, ofertas, horarios (con cortados), métricas, reseñas, chat, soporte.
- Notificaciones: **web-push** (cliente) + **WhatsApp** (negocio) + realtime.
- Panel admin (comisiones, facturación, reportes, reseñas, tickets) y **PWA instalable** con ícono por rol.

---

## 🔴 Prioridad 1 — Alto impacto, esfuerzo razonable
- [x] **Aclaraciones del pedido** 🟢 — ✅ **hecho** (2026-11-21): campo "Aclaraciones" en el checkout → `orders.notes` → se muestra destacado al negocio en el pedido.
- [ ] **Opciones / variantes de producto** 🔴 — tamaño, agregados, sabor, "sin X". Hoy los productos son planos (nombre/precio). Es el más grande pero el que más diferencia para gastronomía.
- [x] **Direcciones guardadas** (sin mapa) 🟡 — ✅ **hecho** (2026-11-21): tabla `customer_addresses`, selector en el checkout (elegir guardada o nueva + "guardar"), y página "Mis direcciones". ⬜ **Falta fase 2: elegir pin en mapa** (falta decidir proveedor: Leaflet+OSM gratis / Google / Mapbox).
- [x] **Tiempo estimado de entrega (ETA)** 🟡 — ✅ **hecho** (2026-11-21): el negocio configura un rango (min–max min) en Ajustes; se muestra en la tienda ("~30-45 min") y al confirmar el pedido se calcula `estimated_delivery`, que el cliente ve en el seguimiento.
- [x] **"Pedir de nuevo" (reordenar)** 🟢 — ✅ **hecho** (2026-11-21): botón en *Mis Pedidos* que rearma el carrito con los productos actuales del negocio (precio/stock de ahora) y avisa si alguno ya no está.
- [ ] **Cupones / código de descuento** 🟡 — canjeable en el checkout (y descuento de primer pedido). Hoy hay ofertas por negocio, pero no código.
- [x] **Favoritos** 🟢 — ✅ **hecho** (2026-11-21): corazón para marcar negocios favoritos + sección "Favoritos" arriba en la tienda. (Productos favoritos: pendiente, opcional.)

## 🟠 Prioridad 2 — Medio plazo
- [ ] **Seguimiento del repartidor en mapa** 🔴 — si el negocio usa cadete (requiere ubicación del repartidor).
- [ ] **Pedido programado** 🟡 — para más tarde / para mañana.
- [ ] **Propina** 🟢 — para el repartidor, opcional en el checkout.
- [ ] **Envío por distancia/zona** 🟡 — hoy es precio fijo (`delivery_fixed_price`).
- [ ] **Comprobante al cliente** 🟡 — email/PDF del pedido (ya hay facturación interna, falta el comprobante al cliente).
- [ ] **Avisos de estado por email** 🟢 — además del push.
- [x] **Orden/filtro en la tienda** 🟢 — ✅ **hecho** (2026-11-21): ordenar por Recomendados / Más rápidos (ETA) / Mejor puntuados + filtro "Abiertos ahora". ⬜ Falta: **búsqueda global de productos** (no solo de negocios).
- [ ] **Calificar al repartidor** y **reseñas con foto** 🟡.

## ⚪ Prioridad 3 — Más adelante / según modelo de negocio
- [ ] **App/panel del repartidor** 🔴 — si suman logística propia.
- [ ] **Suscripción tipo Plus/Prime** 🔴 — envío gratis con cuota (dudoso para ciudad chica).
- [ ] **Puntos / fidelidad** 🟡.
- [ ] **Referidos** 🟡 — invitá y ganá crédito.
- [ ] **Billetera / saldo in-app** 🔴.
- [ ] **Verificación de edad** 🟢 — si venden alcohol.
- [ ] **Carrito multi-negocio** 🔴 — hoy es uno por vez (es una decisión de producto, no necesariamente un faltante).

---

## 🎯 Sugerencia de arranque
Mejor relación impacto/esfuerzo para lo primero:
1. **Aclaraciones del pedido** (🟢) — rápido y lo pide todo el mundo.
2. **Pedir de nuevo** (🟢) — empuja la recompra.
3. **Direcciones guardadas + mapa** (🟡) — menos errores de entrega.
4. **Variantes de producto** (🔴) — si el foco es gastronomía, es el que más diferencia.
