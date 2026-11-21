-- ============================================================
-- Tiempo estimado de entrega por negocio (rango en minutos).
-- Se muestra en la tienda ("~30-45 min") y se usa para calcular la hora
-- estimada del pedido (orders.estimated_delivery).
-- ============================================================
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS eta_min_minutes int;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS eta_max_minutes int;

-- Recrear la vista pública exponiendo el rango de ETA (misma def + 2 columnas).
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
  v.eta_min_minutes,
  v.eta_max_minutes,
  ((v.payment_settings->>'efectivo')::boolean IS TRUE)                      AS accepts_cash,
  ((v.payment_settings->'transferencia'->>'activo')::boolean IS TRUE)       AS accepts_transfer,
  ((v.payment_settings->'mercadoPago'->>'activo')::boolean IS TRUE)         AS accepts_mercadopago,
  (EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.is_available = true)) AS has_products
FROM public.vendors v
WHERE v.is_active = true;

GRANT SELECT ON public.public_vendors TO anon, authenticated;
