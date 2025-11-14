
-- Limpiar sesión del usuario problemático
UPDATE user_sessions
SET 
  last_bot_message = NULL,
  previous_state = NULL,
  in_vendor_chat = false,
  assigned_vendor_phone = NULL,
  updated_at = NOW()
WHERE phone = '5493464448309';

-- Corregir payment_status de pedidos cancelados
UPDATE orders
SET 
  payment_status = 'cancelled',
  updated_at = NOW()
WHERE status = 'cancelled' AND payment_status = 'pending';

-- Corregir payment_status de pedidos entregados
UPDATE orders
SET 
  payment_status = 'paid',
  paid_at = COALESCE(paid_at, updated_at),
  updated_at = NOW()
WHERE status = 'delivered' AND payment_status = 'pending';
