-- =============================================
-- SISTEMA DE DEBOUNCE Y COLA PARA MENSAJES
-- =============================================

-- 1. Crear tabla para buffer de mensajes temporales
CREATE TABLE public.message_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  message_text TEXT,
  image_url TEXT,
  document_url TEXT,
  raw_jid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_message_buffer_phone ON public.message_buffer(phone);
CREATE INDEX idx_message_buffer_created ON public.message_buffer(created_at);

-- RLS: Solo sistema puede manejar el buffer
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage message buffer"
  ON public.message_buffer
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 2. Agregar campos de lock a user_sessions
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS processing_lock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- Índice para buscar locks activos
CREATE INDEX IF NOT EXISTS idx_user_sessions_lock ON public.user_sessions(phone, processing_lock);

-- 3. Función para limpiar mensajes viejos del buffer (más de 5 minutos)
CREATE OR REPLACE FUNCTION cleanup_message_buffer()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM message_buffer 
  WHERE created_at < now() - interval '5 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. Función para liberar locks viejos (más de 30 segundos - anti-deadlock)
CREATE OR REPLACE FUNCTION cleanup_stale_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_sessions 
  SET processing_lock = false, lock_acquired_at = NULL
  WHERE processing_lock = true 
    AND lock_acquired_at < now() - interval '30 seconds';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;