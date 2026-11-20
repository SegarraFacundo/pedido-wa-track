-- ============================================================
-- Storefront público (PWA del cliente): lectura de negocios activos para anon + invitado.
-- Hasta ahora el cliente era SOLO WhatsApp (service role), por eso no había lectura
-- pública de `vendors`. Exponemos una vista con columnas SEGURAS (sin alias/CBU ni
-- payment_settings crudo) y la habilitamos para anon y authenticated.
-- ============================================================

DROP VIEW IF EXISTS public.public_vendors;

-- security_invoker = off (security definer): la vista corre con sus permisos y expone
-- únicamente estas columnas de los negocios ACTIVOS. No filtra por RLS de vendors (que
-- sigue restringida a dueño/admin para acceso directo a la tabla).
CREATE VIEW public.public_vendors
WITH (security_invoker = off) AS
SELECT
  v.id,
  v.name,
  v.category,
  v.image,
  v.address,
  split_part(v.address, ',', 1)                                            AS address_area,
  v.rating,
  v.average_rating,
  v.total_orders,
  v.opening_time,
  v.closing_time,
  v.days_open,
  v.is_active,
  v.joined_at,
  v.allows_pickup,
  v.allows_delivery,
  v.delivery_fixed_price,
  v.pickup_instructions,
  v.available_products,
  ((v.payment_settings->>'efectivo')::boolean IS TRUE)                      AS accepts_cash,
  ((v.payment_settings->'transferencia'->>'activo')::boolean IS TRUE)       AS accepts_transfer,
  ((v.payment_settings->'mercadoPago'->>'activo')::boolean IS TRUE)         AS accepts_mercadopago,
  (EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.is_available = true)) AS has_products
FROM public.vendors v
WHERE v.is_active = true;

GRANT SELECT ON public.public_vendors TO anon, authenticated;
