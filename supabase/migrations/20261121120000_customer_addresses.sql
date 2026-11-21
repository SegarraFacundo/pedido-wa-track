-- ============================================================
-- Direcciones guardadas del cliente (Casa, Trabajo, etc.).
-- El cliente administra las suyas (RLS de dueño). coordinates queda para
-- la fase 2 (elegir en mapa); por ahora puede ser null.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text,            -- "Casa", "Trabajo", etc. (opcional)
  address     text NOT NULL,   -- calle y número (+ depto/piso/referencia)
  coordinates jsonb,           -- { lat, lng } cuando haya mapa (fase 2)
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id ON public.customer_addresses(user_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage their own addresses" ON public.customer_addresses;
CREATE POLICY "Customers manage their own addresses"
  ON public.customer_addresses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
