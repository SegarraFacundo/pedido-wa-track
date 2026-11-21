# 🛵 Epic: App de repartidores (logística propia)

> Diseño para sumar **repartidores** (cadetes) a Lapacho: una app donde ven pedidos, los toman, retiran y entregan — como PedidosYa/Rappi. Cadetes **subcontratados como monotributistas**.
> Fecha: 2026-11-21. Estado: **Fase 1 implementada y en producción** ✅ (ver sección 11).
> Relacionado: `docs/ROADMAP.md`, `docs/BITACORA-PWA.md`.

---

## 1. Objetivo
Hoy el **negocio** gestiona su propia entrega (estados pending → … → delivered, delivery manejado por el negocio). Queremos un **tercer actor operativo**: el **repartidor**, que toma pedidos de varios negocios, los retira y los entrega, con su propia app, seguimiento en mapa y liquidación de pagos.

## 2. Actores
- **Cliente** (ya existe): hace el pedido, lo sigue.
- **Negocio** (ya existe): prepara el pedido, lo marca "listo".
- **Repartidor** (🆕): toma el pedido listo, lo retira y lo entrega. Monotributista subcontratado por Lapacho.
- **Admin** (ya existe): da de alta repartidores, ve la operación, liquida pagos.

## 3. Decisiones de negocio a confirmar (⚠️ definen todo)
1. **¿De quién son los repartidores?**
   - **(A) De la plataforma** (Lapacho los contrata y reparten para todos los negocios). ← *asumido por "subcontratados por nosotros".*
   - (B) Cada negocio tiene los suyos.
   - **Recomendado: A** (flota propia de Lapacho).
2. **¿Cómo se asigna un pedido a un repartidor?**
   - **(A) Pool "tomar"**: el repartidor ve los pedidos listos de su zona y toca "Tomar". Simple, común en operaciones chicas. ← *recomendado para el MVP.*
   - (B) Asignación automática (el sistema elige el más cercano/libre). Más complejo.
   - (C) Asignación manual (admin/negocio asigna). Útil como fallback.
   - **Recomendado: A para el MVP**, con C como respaldo del admin.
3. **¿Cómo cobra el repartidor?**
   - Tarifa por envío (fija, o por distancia), o % del costo de envío.
   - ¿El costo de envío que paga el cliente va al repartidor (y Lapacho cobra comisión al negocio) o Lapacho le paga aparte?
   - **Recomendado MVP**: tarifa por envío (configurable), registrada por pedido; **liquidación semanal**.
4. **¿Quién paga el envío?** Hoy el cliente paga `delivery_fixed_price` al negocio. Hay que definir el reparto: negocio ↔ repartidor ↔ Lapacho.

## 4. Modelo de datos (nuevo)
```
couriers (repartidores)
  id, user_id (auth.users), name, phone, vehicle ('moto'|'bici'|'auto'),
  is_active, is_online (disponible ahora), current_lat, current_lng,
  monotributo_cuit, payout_fee (tarifa por envío por defecto), created_at

-- Asignación/estado de reparto por pedido (1:1 con orders de tipo delivery)
deliveries
  id, order_id (orders), courier_id (couriers, nullable hasta que lo tomen),
  status ('available'|'assigned'|'picked_up'|'delivering'|'delivered'|'cancelled'),
  fee (lo que cobra el repartidor por este envío),
  assigned_at, picked_up_at, delivered_at, created_at

-- Liquidaciones (pagos al repartidor)
courier_payouts
  id, courier_id, period_start, period_end, total_deliveries, total_amount,
  status ('pending'|'paid'), paid_at, created_at
```
En `orders` alcanza con lo que ya hay (`status`, `delivery_type`, `coordinates`); el detalle de reparto vive en `deliveries`. Rol nuevo: agregar `'repartidor'` al enum `app_role` y usar `has_role(uid,'repartidor')` en RLS.

## 5. Ciclo de vida del pedido (con repartidor)
```
Cliente crea pedido (delivery)
  → negocio: confirmed → preparing → ready        (igual que hoy)
  → al pasar a "ready": se crea deliveries(status='available')  (pool)
  → repartidor toma: assigned → picked_up (retiró) → delivering (en camino) → delivered
  → orders.status se sincroniza: delivering ↔ "en camino", delivered ↔ "entregado"
```
Retiro en local (pickup) **no** genera delivery.

## 6. Auth, RLS y acceso
- Rol `repartidor` (tabla `user_roles`, enum `app_role`).
- Subdominio **`repartidor.lapacho.ar`** → login propio (`/repartidor-auth`) y panel (`/repartidor`), igual que soporte/admin (agregar caso en `SubdomainRouter` **permitiendo `/repartidor-auth`** para no repetir el bug del loop que ya arreglamos).
- Manifest PWA propio (`manifest-repartidor.json`) + ícono por rol (misma hoja, color propio, letra "R").
- RLS: el repartidor ve/actualiza `deliveries` disponibles o asignadas a él; lee datos mínimos del pedido (dirección, items, teléfono del cliente para coordinar); no ve datos sensibles de otros.

## 7. App del repartidor — pantallas (MVP)
1. **Login** (email/password o magic link).
2. **Disponible / Offline** (toggle is_online) + **Pedidos disponibles** (lista de deliveries 'available' con negocio, zona, distancia, tarifa) → "Tomar".
3. **Mi pedido activo**: dirección de retiro (negocio) y de entrega (cliente), botones de estado (Retiré → En camino → Entregué), link a mapa, teléfono del cliente/negocio, aclaraciones del pedido.
4. **Historial** y **Ganancias** (entregas y total del período).

## 8. Mapa / ubicación en vivo
- Proveedor recomendado: **Leaflet + OpenStreetMap** (gratis, sin API key). Para ruta/navegación, abrir Google Maps con la dirección (deep link) en el MVP.
- La app del repartidor actualiza `couriers.current_lat/lng` cada X seg mientras está "en camino"; el **cliente** ve el pin del repartidor en `OrderStatus` (fase 2 de "seguimiento en mapa" del roadmap).

## 9. Pagos / liquidaciones (monotributo)
- Cada `deliveries.fee` registra lo que gana el repartidor por ese envío.
- **Liquidación** (admin): agrupa las entregas 'delivered' no liquidadas de un período → `courier_payouts` (total) → se paga por fuera (transferencia) y se marca 'paid'.
- El repartidor, como **monotributista**, factura a Lapacho por sus servicios (el comprobante/cadena de facturación es administrativo, fuera de la app en el MVP; se puede sumar después).

## 10. Impacto en lo existente
- `crear-pedido`: sin cambios (el delivery se crea al pasar a "ready", vía trigger o al cambiar estado).
- Cambio de estado del pedido ↔ delivery: sincronizar (un trigger en DB, o lógica en el panel del negocio / la app del repartidor).
- `OrderCard` (negocio) y `OrderStatus` (cliente): mostrar repartidor asignado + su estado.
- `SubdomainRouter`, manifests, íconos: sumar el rol repartidor.

## 11. Fases
- **Fase 1 (MVP)** ✅ **HECHO (2026-11-21)**: rol `repartidor`, tablas couriers/deliveries/courier_payouts + trigger (pool al marcar "ready"), alta de repartidores en el admin, app `/repartidor` (online, pool "tomar", estados retiré/en camino/entregué, ganancias del día), tarifa por envío manual, subdominio + manifest + ícono. Sin mapa en vivo (deep-link a Google Maps). **Para usar**: Admin → Repartidores (crear con email/contraseña/tarifa) → el repartidor entra en `/repartidor-auth` (o `repartidor.lapacho.ar`), se pone "Disponible", y cuando un negocio marca un pedido "Listo" aparece en el pool.
- **Fase 2** (en curso): ✅ **liquidaciones** (admin); ✅ **mapa en vivo** (el repartidor comparte ubicación con `geolocation` mientras tiene un reparto activo → `couriers.current_lat/lng`; el cliente ve el pin en el seguimiento cuando el pedido está "en camino", vía la edge function `order-courier-location` + Leaflet/OpenStreetMap). ⬜ Falta: asignación automática por cercanía.
- **Fase 3**: navegación integrada, ratings del repartidor, zonas, turnos.

## 12. Próximo paso
Confirmar las **4 decisiones de la sección 3**. Con eso, cerramos el modelo y arrancamos la **Fase 1** (empezando por la migración `couriers`/`deliveries` + rol, y el alta de repartidores en el admin).
