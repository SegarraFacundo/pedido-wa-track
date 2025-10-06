-- Actualizar política para permitir inserción de mensajes de soporte
DROP POLICY IF EXISTS "Soporte puede crear mensajes" ON support_messages;

CREATE POLICY "Soporte puede crear mensajes" 
ON support_messages 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'soporte'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND sender_type = 'support'
);