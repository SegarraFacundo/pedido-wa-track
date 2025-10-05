-- Función para limpiar sesiones viejas (más de 7 días sin actividad)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE updated_at < NOW() - INTERVAL '7 days'
    AND in_vendor_chat = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Habilitar Row Level Security si no está habilitado
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen para recrearlas
DROP POLICY IF EXISTS "System can manage user sessions" ON user_sessions;
DROP POLICY IF EXISTS "System can manage customer messages" ON customer_messages;
DROP POLICY IF EXISTS "Vendors can view their assigned messages" ON customer_messages;
DROP POLICY IF EXISTS "Vendors can update their assigned messages" ON customer_messages;

-- Políticas RLS para user_sessions
CREATE POLICY "System can manage user sessions"
  ON user_sessions
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Políticas RLS para customer_messages
CREATE POLICY "System can manage customer messages"
  ON customer_messages
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Los vendedores pueden ver mensajes asignados a ellos
CREATE POLICY "Vendors can view their assigned messages"
  ON customer_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN vendors v ON v.phone = us.assigned_vendor_phone OR v.whatsapp_number = us.assigned_vendor_phone
      WHERE us.phone = customer_messages.customer_phone
      AND v.user_id = auth.uid()
    )
  );

-- Los vendedores pueden marcar como leídos sus mensajes
CREATE POLICY "Vendors can update their assigned messages"
  ON customer_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN vendors v ON v.phone = us.assigned_vendor_phone OR v.whatsapp_number = us.assigned_vendor_phone
      WHERE us.phone = customer_messages.customer_phone
      AND v.user_id = auth.uid()
    )
  );