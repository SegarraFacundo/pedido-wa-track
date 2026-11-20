-- ============================================================
-- Fase 0 — PWA del cliente: identidad, carrito y RLS de cliente
-- Migra el canal del cliente de WhatsApp a web.
-- Convenciones existentes reutilizadas:
--   - public.update_updated_at_column()  (trigger updated_at)
--   - gen_random_uuid()                  (PKs)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Identidad del cliente en orders: atar el pedido a auth.users
--    Hoy la identidad es customer_phone (string). Agregamos user_id
--    para poder aplicar RLS por usuario autenticado.
-- ------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- El cliente puede VER sólo sus propios pedidos.
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- NOTA: la CREACIÓN de pedidos sigue siendo exclusiva de service_role
-- (edge function crear-pedido). El cliente NO inserta en orders directamente.
-- Esto conserva la validación server-side (stock, duplicados, métodos de pago).

-- ------------------------------------------------------------
-- 2) Pagos e historial de estado: el cliente ve lo de SUS pedidos
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view their order payments" ON public.order_payments;
CREATE POLICY "Customers can view their order payments"
  ON public.order_payments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_payments.order_id
      AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Customers can view their order history" ON public.order_status_history;
CREATE POLICY "Customers can view their order history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.user_id = auth.uid()
  ));

-- ------------------------------------------------------------
-- 3) Carrito del cliente
--    Materializa el carrito que hoy vive dentro del JSON de contexto
--    del bot (user_sessions.last_bot_message). Un carrito activo por
--    usuario, atado a un único vendor (igual que el modelo actual).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carts (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id  uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carts_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- El cliente administra (lee/escribe/borra) sólo su propio carrito.
DROP POLICY IF EXISTS "Customers manage their own cart" ON public.carts;
CREATE POLICY "Customers manage their own cart"
  ON public.carts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_carts_updated_at ON public.carts;
CREATE TRIGGER set_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
