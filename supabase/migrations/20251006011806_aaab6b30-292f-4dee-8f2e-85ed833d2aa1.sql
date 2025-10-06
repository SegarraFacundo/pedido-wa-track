-- Habilitar realtime para tablas de soporte
ALTER TABLE support_tickets REPLICA IDENTITY FULL;
ALTER TABLE support_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;