-- ============================================================
-- Negocios favoritos del cliente. El cliente administra los suyos (RLS de dueño).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id  uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_user_id ON public.customer_favorites(user_id);

ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage their own favorites" ON public.customer_favorites;
CREATE POLICY "Customers manage their own favorites"
  ON public.customer_favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
