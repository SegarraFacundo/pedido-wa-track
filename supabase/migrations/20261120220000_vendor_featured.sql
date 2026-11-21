-- ============================================================
-- Negocios destacados (promoción paga): aparecen en una sección propia
-- arriba de todo en el storefront del cliente.
-- ============================================================

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Datos de demo: dejamos un par destacados para ver la sección funcionando.
-- (En producción lo activa/desactiva el admin según quién pague.)
UPDATE public.vendors SET is_featured = true WHERE slug IN ('pizzeria-don-luigi', 'burger-house');

-- Recrear la vista pública exponiendo is_featured (misma def + columna).
DROP VIEW IF EXISTS public.public_vendors;
CREATE VIEW public.public_vendors
WITH (security_invoker = off) AS
SELECT
  v.id,
  v.slug,
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
  v.is_featured,
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
