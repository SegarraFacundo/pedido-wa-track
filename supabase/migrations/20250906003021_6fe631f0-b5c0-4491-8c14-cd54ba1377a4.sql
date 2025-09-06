-- Create table for payment methods
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default payment methods
INSERT INTO public.payment_methods (name, is_active) VALUES
  ('Efectivo', true),
  ('Transferencia bancaria', true),
  ('Tarjeta de débito', true),
  ('Tarjeta de crédito', true),
  ('MercadoPago', true),
  ('Yape', true),
  ('Plin', true);

-- Create table for order payments
CREATE TABLE public.order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  transaction_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add payment fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Update products table to ensure price is available
ALTER TABLE public.products
ALTER COLUMN price SET NOT NULL;

-- Create table for order status history
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('customer', 'vendor', 'system')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods
CREATE POLICY "Anyone can view payment methods"
ON public.payment_methods
FOR SELECT
USING (is_active = true);

-- RLS Policies for order_payments
CREATE POLICY "Vendors can view payments for their orders"
ON public.order_payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orders o
  JOIN vendors v ON v.id = o.vendor_id
  WHERE o.id = order_payments.order_id
  AND v.user_id = auth.uid()
));

CREATE POLICY "System can manage payments"
ON public.order_payments
FOR ALL
USING (true);

-- RLS Policies for order_status_history
CREATE POLICY "Vendors can view status history for their orders"
ON public.order_status_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orders o
  JOIN vendors v ON v.id = o.vendor_id
  WHERE o.id = order_status_history.order_id
  AND v.user_id = auth.uid()
));

CREATE POLICY "Anyone can create status history"
ON public.order_status_history
FOR INSERT
WITH CHECK (true);

-- Create function to get available products with prices
CREATE OR REPLACE FUNCTION public.get_products_by_category(category_filter TEXT DEFAULT NULL)
RETURNS TABLE(
  vendor_id UUID,
  vendor_name TEXT,
  product_id UUID,
  product_name TEXT,
  product_description TEXT,
  product_price NUMERIC,
  product_category TEXT,
  is_available BOOLEAN,
  vendor_rating NUMERIC,
  vendor_is_open BOOLEAN
) 
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    p.price as product_price,
    p.category as product_category,
    p.is_available,
    v.average_rating as vendor_rating,
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::TEXT = ANY(v.days_open)
        AND CURRENT_TIME BETWEEN v.opening_time AND v.closing_time
      THEN true
      ELSE false
    END as vendor_is_open
  FROM vendors v
  JOIN products p ON p.vendor_id = v.id
  WHERE 
    v.is_active = true
    AND p.is_available = true
    AND (category_filter IS NULL OR LOWER(p.category) LIKE LOWER('%' || category_filter || '%'))
  ORDER BY vendor_is_open DESC, v.average_rating DESC, p.price ASC;
END;
$$;

-- Create trigger for order_payments updated_at
CREATE TRIGGER update_order_payments_updated_at
BEFORE UPDATE ON public.order_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle order status changes
CREATE OR REPLACE FUNCTION public.change_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_changed_by TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_status TEXT;
  v_vendor_id UUID;
BEGIN
  -- Get current order status and vendor
  SELECT status, vendor_id INTO v_current_status, v_vendor_id
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Validate status transitions
  -- Customer can cancel if pending/confirmed
  IF p_changed_by = 'customer' AND p_new_status = 'cancelled' THEN
    IF v_current_status NOT IN ('pending', 'confirmed') THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Vendor can change status based on workflow
  IF p_changed_by = 'vendor' THEN
    -- Add validation logic here based on your business rules
    NULL;
  END IF;
  
  -- Update order status
  UPDATE orders
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Record status change in history
  INSERT INTO order_status_history (order_id, status, changed_by, reason)
  VALUES (p_order_id, p_new_status, p_changed_by, p_reason);
  
  RETURN TRUE;
END;
$$;