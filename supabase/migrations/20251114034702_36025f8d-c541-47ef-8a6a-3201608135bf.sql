
-- Crear función para sincronizar payment_status automáticamente
CREATE OR REPLACE FUNCTION sync_payment_status_on_order_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el pedido se cancela, marcar payment_status como cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.payment_status = 'cancelled';
    NEW.updated_at = NOW();
  END IF;
  
  -- Si el pedido se entrega, marcar payment_status como paid (si aún no está pagado)
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    IF NEW.payment_status != 'paid' THEN
      NEW.payment_status = 'paid';
      NEW.paid_at = COALESCE(NEW.paid_at, NOW());
      NEW.updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger que ejecuta la función antes de actualizar
DROP TRIGGER IF EXISTS sync_payment_status_trigger ON orders;
CREATE TRIGGER sync_payment_status_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_status_on_order_update();

-- Comentario explicativo
COMMENT ON FUNCTION sync_payment_status_on_order_update() IS 
'Sincroniza automáticamente payment_status cuando cambia el status del pedido:
- cancelled → payment_status = cancelled
- delivered → payment_status = paid (si no está ya pagado)';
