-- ============================================================
-- Cupones de descuento (código canjeable en el checkout).
-- Los administra el admin; los clientes autenticados pueden LEER los activos
-- para validar el código antes de pagar. crear-pedido revalida y aplica.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code           text NOT NULL UNIQUE,
  discount_type  text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order      numeric,           -- monto mínimo de subtotal para que aplique (opcional)
  valid_until    timestamptz,       -- vencimiento (opcional)
  max_uses       int,               -- usos máximos totales (opcional)
  uses_count     int NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Clientes autenticados: leer cupones activos (para validar el código al pagar).
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
CREATE POLICY "Anyone can read active coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin: ABM completo de cupones.
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Guardar el cupón y el descuento aplicado en el pedido.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
