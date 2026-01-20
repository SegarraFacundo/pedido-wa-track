-- Habilitar realtime para orders si no está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- Crear tabla de historial de notificaciones para vendors
CREATE TABLE IF NOT EXISTS public.vendor_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_order', 'order_cancelled', 'payment_received', 'order_updated', 'customer_message')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_vendor_notification_history_vendor_id ON public.vendor_notification_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notification_history_is_read ON public.vendor_notification_history(vendor_id, is_read);
CREATE INDEX IF NOT EXISTS idx_vendor_notification_history_created_at ON public.vendor_notification_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.vendor_notification_history ENABLE ROW LEVEL SECURITY;

-- Política: Vendors pueden ver sus propias notificaciones
CREATE POLICY "Vendors can view own notifications"
  ON public.vendor_notification_history
  FOR SELECT
  USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

-- Política: Vendors pueden actualizar sus propias notificaciones (marcar como leídas)
CREATE POLICY "Vendors can update own notifications"
  ON public.vendor_notification_history
  FOR UPDATE
  USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

-- Política: Sistema puede insertar notificaciones (service role)
CREATE POLICY "System can insert notifications"
  ON public.vendor_notification_history
  FOR INSERT
  WITH CHECK (true);

-- Habilitar realtime para la tabla de notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_notification_history;