-- Permitir que el sistema cierre tickets cuando el cliente lo solicita
CREATE POLICY "Sistema puede actualizar tickets" 
ON support_tickets 
FOR UPDATE 
USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));