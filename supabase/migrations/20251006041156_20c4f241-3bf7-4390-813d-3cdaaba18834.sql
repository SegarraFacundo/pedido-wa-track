-- Actualizar políticas para que admin tenga acceso completo a soporte
-- Los admins ya tienen acceso, pero vamos a simplificar las políticas

-- Actualizar política de creación de tickets
DROP POLICY IF EXISTS "Sistema puede crear tickets" ON support_tickets;
CREATE POLICY "Admin puede crear tickets" 
ON support_tickets 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Actualizar política de actualización de tickets
DROP POLICY IF EXISTS "Soporte puede actualizar tickets" ON support_tickets;
CREATE POLICY "Admin puede actualizar tickets" 
ON support_tickets 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Actualizar política de lectura de tickets
DROP POLICY IF EXISTS "Soporte puede ver todos los tickets" ON support_tickets;
CREATE POLICY "Admin puede ver todos los tickets" 
ON support_tickets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Actualizar política de creación de mensajes
DROP POLICY IF EXISTS "Soporte puede crear mensajes" ON support_messages;
CREATE POLICY "Admin puede crear mensajes" 
ON support_messages 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND sender_type = 'support');

-- Actualizar política de lectura de mensajes
DROP POLICY IF EXISTS "Soporte puede ver mensajes de tickets" ON support_messages;
CREATE POLICY "Admin puede ver mensajes de tickets" 
ON support_messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));