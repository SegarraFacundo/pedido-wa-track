-- Función para descontar stock cuando se confirma un pedido
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item JSONB;
  product_id_val UUID;
  quantity_val INTEGER;
  current_stock INTEGER;
BEGIN
  -- Solo ejecutar cuando el estado cambia a 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Iterar sobre cada item del pedido
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items::jsonb)
    LOOP
      -- Extraer product_id y quantity del item
      product_id_val := (item->>'id')::UUID;
      quantity_val := COALESCE((item->>'quantity')::INTEGER, 1);
      
      -- Solo actualizar si el producto existe y tiene stock habilitado
      UPDATE products
      SET 
        stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - quantity_val),
        updated_at = NOW()
      WHERE id = product_id_val
        AND stock_enabled = true
        AND stock_quantity IS NOT NULL;
      
      IF FOUND THEN
        -- Log del descuento de stock
        RAISE NOTICE 'Stock deducted: product_id=%, quantity=%, order_id=%', 
          product_id_val, quantity_val, NEW.id;
      END IF;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para descontar stock al confirmar pedido
DROP TRIGGER IF EXISTS trigger_deduct_stock_on_confirmed ON orders;
CREATE TRIGGER trigger_deduct_stock_on_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_on_order_confirmed();

-- También manejar el caso de INSERT con status = 'confirmed' directamente
DROP TRIGGER IF EXISTS trigger_deduct_stock_on_insert_confirmed ON orders;
CREATE TRIGGER trigger_deduct_stock_on_insert_confirmed
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.deduct_stock_on_order_confirmed();