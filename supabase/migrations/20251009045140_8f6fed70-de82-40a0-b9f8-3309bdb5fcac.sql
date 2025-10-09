-- Primero eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Block public access to orders" ON public.orders;
DROP POLICY IF EXISTS "Vendors can view order IDs only" ON public.orders;

-- Crear una política más clara para que los vendors puedan ver sus pedidos
CREATE POLICY "Vendors can view their orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendors
    WHERE vendors.id = orders.vendor_id
    AND vendors.user_id = auth.uid()
  )
);