-- Eliminar constraint si existe
ALTER TABLE order_payments DROP CONSTRAINT IF EXISTS order_payments_status_check;

-- Ahora migrar datos históricos de orders a order_payments
INSERT INTO order_payments (order_id, amount, payment_method_name, status, payment_date, created_at, updated_at)
SELECT 
  id as order_id,
  total as amount,
  COALESCE(payment_method, 'efectivo') as payment_method_name,
  COALESCE(payment_status, 'pending') as status,
  CASE 
    WHEN payment_status = 'paid' AND paid_at IS NOT NULL THEN paid_at
    WHEN payment_status = 'paid' THEN created_at
    ELSE NULL
  END as payment_date,
  created_at,
  updated_at
FROM orders
WHERE NOT EXISTS (
  SELECT 1 FROM order_payments 
  WHERE order_payments.order_id = orders.id
);

-- Crear trigger para mantener orders.payment_status sincronizado con order_payments
CREATE OR REPLACE FUNCTION sync_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se actualiza un pago, actualizar el estado en orders
  UPDATE orders
  SET 
    payment_status = NEW.status,
    paid_at = NEW.payment_date,
    updated_at = NOW()
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger en order_payments
DROP TRIGGER IF EXISTS sync_payment_status_trigger ON order_payments;
CREATE TRIGGER sync_payment_status_trigger
AFTER INSERT OR UPDATE OF status, payment_date
ON order_payments
FOR EACH ROW
EXECUTE FUNCTION sync_order_payment_status();