-- Tabla para direcciones guardadas de usuarios
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  is_temporary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(phone, name)
);

-- Índice para búsquedas rápidas por teléfono
CREATE INDEX IF NOT EXISTS idx_saved_addresses_phone ON public.saved_addresses(phone);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_temporary ON public.saved_addresses(phone, is_temporary);

-- RLS: Los usuarios del sistema pueden acceder
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage saved addresses"
  ON public.saved_addresses
  FOR ALL
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

COMMENT ON TABLE public.saved_addresses IS 'Direcciones guardadas por usuarios de WhatsApp';
COMMENT ON COLUMN public.saved_addresses.is_temporary IS 'Si es true, se eliminará automáticamente al completar el pedido';