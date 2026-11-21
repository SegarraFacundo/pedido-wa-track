-- ============================================================
-- Logística propia: repartidores (couriers), repartos (deliveries) y
-- liquidaciones (courier_payouts). El acceso operativo del repartidor pasa
-- por edge functions con service role; acá dejamos RLS de admin y de dueño.
-- ============================================================

-- ── Repartidores ──
CREATE TABLE IF NOT EXISTS public.couriers (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  phone            text,
  vehicle          text,                       -- 'moto' | 'bici' | 'auto'
  monotributo_cuit text,
  payout_fee       numeric NOT NULL DEFAULT 0, -- tarifa por envío acordada
  is_active        boolean NOT NULL DEFAULT true,
  is_online        boolean NOT NULL DEFAULT false,
  current_lat      double precision,
  current_lng      double precision,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Reparto por pedido (1:1 con orders de tipo delivery) ──
CREATE TABLE IF NOT EXISTS public.deliveries (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id    uuid REFERENCES public.couriers(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled')),
  fee           numeric NOT NULL DEFAULT 0,
  assigned_at   timestamptz,
  picked_up_at  timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON public.deliveries(courier_id);

-- ── Liquidaciones al repartidor ──
CREATE TABLE IF NOT EXISTS public.courier_payouts (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id       uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  period_start     date,
  period_end       date,
  total_deliveries int NOT NULL DEFAULT 0,
  total_amount     numeric NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Al marcar el pedido "ready" (y es delivery), entra al pool de repartos ──
CREATE OR REPLACE FUNCTION public.create_delivery_on_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready'
     AND (OLD.status IS DISTINCT FROM 'ready')
     AND COALESCE(NEW.delivery_type, 'delivery') = 'delivery' THEN
    INSERT INTO public.deliveries (order_id, status)
    VALUES (NEW.id, 'available')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_delivery_on_ready ON public.orders;
CREATE TRIGGER trg_create_delivery_on_ready
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_delivery_on_ready();

-- ── RLS ──
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_payouts ENABLE ROW LEVEL SECURITY;

-- Admin administra todo.
DROP POLICY IF EXISTS "Admins manage couriers" ON public.couriers;
CREATE POLICY "Admins manage couriers" ON public.couriers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage deliveries" ON public.deliveries;
CREATE POLICY "Admins manage deliveries" ON public.deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage payouts" ON public.courier_payouts;
CREATE POLICY "Admins manage payouts" ON public.courier_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- El repartidor ve/edita su propio perfil (is_online, ubicación).
DROP POLICY IF EXISTS "Couriers manage own profile" ON public.couriers;
CREATE POLICY "Couriers manage own profile" ON public.couriers FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- El repartidor lee sus liquidaciones.
DROP POLICY IF EXISTS "Couriers read own payouts" ON public.courier_payouts;
CREATE POLICY "Couriers read own payouts" ON public.courier_payouts FOR SELECT TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));

-- deliveries: el acceso operativo del repartidor va por edge functions (service role).
