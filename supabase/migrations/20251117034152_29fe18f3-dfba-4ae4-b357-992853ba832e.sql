-- Tabla para analytics de cambio de negocio
CREATE TABLE IF NOT EXISTS public.vendor_change_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Información del usuario (anonimizada)
  user_phone_hash TEXT NOT NULL, -- Hash del teléfono para privacidad
  
  -- Acción tomada
  action TEXT NOT NULL CHECK (action IN ('confirmed', 'cancelled')),
  
  -- Información de los vendors
  current_vendor_id UUID NOT NULL REFERENCES vendors(id),
  current_vendor_name TEXT NOT NULL,
  pending_vendor_id UUID NOT NULL REFERENCES vendors(id),
  pending_vendor_name TEXT NOT NULL,
  
  -- Contexto del carrito
  cart_items_count INTEGER NOT NULL DEFAULT 0,
  cart_total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Estado del pedido
  order_state TEXT,
  
  -- Metadata adicional
  session_duration_seconds INTEGER, -- Tiempo que tardó en decidir
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_vendor_change_analytics_created_at 
  ON vendor_change_analytics(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_vendor_change_analytics_action 
  ON vendor_change_analytics(action);
  
CREATE INDEX IF NOT EXISTS idx_vendor_change_analytics_current_vendor 
  ON vendor_change_analytics(current_vendor_id);
  
CREATE INDEX IF NOT EXISTS idx_vendor_change_analytics_pending_vendor 
  ON vendor_change_analytics(pending_vendor_id);

-- Vista agregada para métricas rápidas
CREATE OR REPLACE VIEW vendor_change_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  action,
  COUNT(*) as total_events,
  AVG(cart_items_count) as avg_cart_items,
  AVG(cart_total_amount) as avg_cart_value,
  AVG(session_duration_seconds) as avg_decision_time_seconds,
  COUNT(DISTINCT user_phone_hash) as unique_users
FROM vendor_change_analytics
GROUP BY DATE_TRUNC('day', created_at), action
ORDER BY date DESC, action;

-- Vista por vendor para ver qué negocios "pierden" o "ganan" clientes
CREATE OR REPLACE VIEW vendor_change_summary AS
SELECT 
  v.id as vendor_id,
  v.name as vendor_name,
  v.category,
  -- Cuántos usuarios cancelaron cambio y se quedaron con este vendor
  COUNT(*) FILTER (WHERE vca.action = 'cancelled' AND vca.current_vendor_id = v.id) as retained_customers,
  -- Cuántos usuarios confirmaron cambio desde este vendor
  COUNT(*) FILTER (WHERE vca.action = 'confirmed' AND vca.current_vendor_id = v.id) as lost_customers,
  -- Cuántos usuarios confirmaron cambio hacia este vendor
  COUNT(*) FILTER (WHERE vca.action = 'confirmed' AND vca.pending_vendor_id = v.id) as acquired_customers,
  -- Net change (ganados - perdidos)
  COUNT(*) FILTER (WHERE vca.action = 'confirmed' AND vca.pending_vendor_id = v.id) - 
  COUNT(*) FILTER (WHERE vca.action = 'confirmed' AND vca.current_vendor_id = v.id) as net_customer_change
FROM vendors v
LEFT JOIN vendor_change_analytics vca 
  ON (v.id = vca.current_vendor_id OR v.id = vca.pending_vendor_id)
WHERE vca.created_at >= NOW() - INTERVAL '30 days' OR vca.created_at IS NULL
GROUP BY v.id, v.name, v.category
ORDER BY net_customer_change DESC;

-- RLS: Solo admins pueden ver analytics
ALTER TABLE vendor_change_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics"
  ON vendor_change_analytics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert analytics"
  ON vendor_change_analytics
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Comentarios para documentación
COMMENT ON TABLE vendor_change_analytics IS 'Analytics de decisiones de cambio de negocio - trackea confirmaciones y cancelaciones';
COMMENT ON COLUMN vendor_change_analytics.user_phone_hash IS 'SHA256 hash del teléfono para análisis agregado preservando privacidad';
COMMENT ON COLUMN vendor_change_analytics.action IS 'Acción del usuario: confirmed (cambió de negocio) o cancelled (mantuvo negocio actual)';
COMMENT ON COLUMN vendor_change_analytics.session_duration_seconds IS 'Tiempo en segundos desde que se mostró la confirmación hasta la decisión';

COMMENT ON VIEW vendor_change_metrics IS 'Métricas agregadas diarias de cambios de negocio';
COMMENT ON VIEW vendor_change_summary IS 'Resumen por vendor: clientes retenidos, perdidos y adquiridos en últimos 30 días';