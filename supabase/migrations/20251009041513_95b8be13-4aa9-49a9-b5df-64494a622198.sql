-- Asegurar que la tabla orders tenga realtime habilitado correctamente
-- Esto permite que los cambios se detecten en tiempo real en el dashboard del vendedor

-- Configurar REPLICA IDENTITY para capturar todos los cambios
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Verificar que la tabla esté en la publicación de realtime
DO $$
BEGIN
  -- Agregar la tabla a la publicación si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;