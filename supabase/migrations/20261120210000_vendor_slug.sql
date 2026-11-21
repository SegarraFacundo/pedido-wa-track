-- ============================================================
-- Slug legible por negocio: links lindos tipo /tienda/pizzeria-don-luigi
-- en vez de /tienda/<uuid>. Se genera desde el nombre, único por negocio.
-- ============================================================

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS slug text;

-- Convierte un texto a slug (minúsculas, sin tildes, separado por guiones).
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM
    regexp_replace(
      lower(translate(
        coalesce(txt, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

-- Asigna un slug único al negocio si no tiene (agrega sufijo numérico si choca).
CREATE OR REPLACE FUNCTION public.set_vendor_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;
  base := public.slugify(NEW.name);
  IF base = '' THEN base := 'negocio'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.vendors WHERE slug = candidate AND id <> NEW.id) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_vendor_slug ON public.vendors;
CREATE TRIGGER trg_set_vendor_slug
  BEFORE INSERT OR UPDATE OF name ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_vendor_slug();

-- Poblar los negocios existentes (slug único para cada uno).
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT id, name FROM public.vendors
    WHERE slug IS NULL OR slug = ''
    ORDER BY joined_at NULLS LAST, name
  LOOP
    base := public.slugify(r.name);
    IF base = '' THEN base := 'negocio'; END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.vendors WHERE slug = candidate AND id <> r.id) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    UPDATE public.vendors SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vendors_slug_key ON public.vendors (slug) WHERE slug IS NOT NULL;

-- Exponer el slug en la vista pública del storefront (misma def + slug).
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
