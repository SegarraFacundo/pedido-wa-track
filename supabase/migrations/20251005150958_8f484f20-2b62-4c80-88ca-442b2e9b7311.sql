-- Tabla para sesiones de usuario (manejo de estado bot/vendedor)
CREATE TABLE IF NOT EXISTS user_sessions (
  phone TEXT PRIMARY KEY,
  in_vendor_chat BOOLEAN DEFAULT FALSE,
  assigned_vendor_phone TEXT,
  last_bot_message TEXT,
  previous_state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas en user_sessions
CREATE INDEX idx_user_sessions_vendor_chat ON user_sessions(in_vendor_chat) WHERE in_vendor_chat = TRUE;
CREATE INDEX idx_user_sessions_assigned_vendor ON user_sessions(assigned_vendor_phone) WHERE assigned_vendor_phone IS NOT NULL;

-- Tabla para mensajes de clientes mientras están en chat con vendedor
CREATE TABLE IF NOT EXISTS customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para customer_messages
CREATE INDEX idx_customer_messages_phone ON customer_messages(customer_phone);
CREATE INDEX idx_customer_messages_unread ON customer_messages(read) WHERE read = FALSE;

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

-- Habilitar Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_sessions
-- El sistema (service_role) puede hacer todo
CREATE POLICY "System can manage user sessions"
  ON user_sessions
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Políticas RLS para customer_messages
-- El sistema puede hacer todo
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

-- Comentarios
COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios para manejo de chat bot/vendedor';
COMMENT ON TABLE customer_messages IS 'Mensajes de clientes mientras están en chat con vendedor';