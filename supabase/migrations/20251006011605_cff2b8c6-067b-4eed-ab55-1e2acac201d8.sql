-- Crear tabla de tickets de soporte
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Crear tabla de mensajes de tickets
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_phone);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- Habilitar RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para support_tickets
CREATE POLICY "Soporte puede ver todos los tickets"
ON support_tickets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'soporte') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Soporte puede actualizar tickets"
ON support_tickets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'soporte') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema puede crear tickets"
ON support_tickets
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'soporte'));

-- Políticas para support_messages
CREATE POLICY "Soporte puede ver mensajes de tickets"
ON support_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'soporte') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Soporte puede crear mensajes"
ON support_messages
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'soporte') OR has_role(auth.uid(), 'admin'));

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_support_ticket_timestamp();