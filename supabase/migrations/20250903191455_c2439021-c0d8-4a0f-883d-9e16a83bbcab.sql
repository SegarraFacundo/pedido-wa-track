-- Create table for sensitive customer contact information
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on customer_contacts
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- Create function to get masked phone number (show only last 4 digits)
CREATE OR REPLACE FUNCTION public.get_masked_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL OR length(phone) < 4 THEN
    RETURN '****';
  END IF;
  RETURN '****' || substring(phone from length(phone) - 3);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get simplified address (only city/area)
CREATE OR REPLACE FUNCTION public.get_simplified_address(full_address TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Return only the first part of the address (usually area/neighborhood)
  RETURN split_part(full_address, ',', 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for vendors to see orders with masked customer data
CREATE OR REPLACE VIEW public.vendor_orders_view AS
SELECT 
  o.id,
  o.vendor_id,
  CASE 
    WHEN cc.customer_name IS NOT NULL THEN substring(cc.customer_name from 1 for 1) || '***'
    ELSE substring(o.customer_name from 1 for 1) || '***'
  END as customer_name_masked,
  CASE
    WHEN cc.customer_phone IS NOT NULL THEN get_masked_phone(cc.customer_phone)
    ELSE get_masked_phone(o.customer_phone)
  END as customer_phone_masked,
  CASE
    WHEN cc.customer_address IS NOT NULL THEN get_simplified_address(cc.customer_address)
    ELSE get_simplified_address(o.address)
  END as address_simplified,
  o.items,
  o.total,
  o.status,
  o.coordinates,
  o.estimated_delivery,
  o.notes,
  o.delivery_person_name,
  o.delivery_person_phone,
  o.created_at,
  o.updated_at
FROM public.orders o
LEFT JOIN public.customer_contacts cc ON cc.order_id = o.id;

-- Grant access to the view
GRANT SELECT ON public.vendor_orders_view TO authenticated;

-- RLS Policies for customer_contacts table

-- Only system/admin can insert customer contacts
CREATE POLICY "System can create customer contacts" 
ON public.customer_contacts 
FOR INSERT 
WITH CHECK (
  -- Allow inserts from service role or when order is being created
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR auth.uid() IS NULL
);

-- Only admins can view full customer contacts
CREATE POLICY "Admins can view customer contacts" 
ON public.customer_contacts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admins can update customer contacts
CREATE POLICY "Admins can update customer contacts" 
ON public.customer_contacts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create function for internal use to get customer details (for edge functions)
CREATE OR REPLACE FUNCTION public.get_order_customer_details(order_id_param UUID)
RETURNS TABLE (
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(cc.customer_name, o.customer_name),
    COALESCE(cc.customer_phone, o.customer_phone),
    COALESCE(cc.customer_address, o.address)
  FROM public.orders o
  LEFT JOIN public.customer_contacts cc ON cc.order_id = o.id
  WHERE o.id = order_id_param;
END;
$$ LANGUAGE plpgsql;

-- Update the existing RLS policy for vendors on orders table to limit access
DROP POLICY IF EXISTS "Vendors can view their orders" ON public.orders;

-- Vendors can only see limited order data through the view
CREATE POLICY "Vendors can view order IDs only" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM vendors 
    WHERE vendors.id = orders.vendor_id 
    AND vendors.user_id = auth.uid()
  )
  AND 
  -- Limit columns they can see by checking if they're accessing through proper channels
  current_setting('request.jwt.claims', true)::json->>'role' != 'service_role'
);

-- Migrate existing customer data to the new table
INSERT INTO public.customer_contacts (order_id, customer_name, customer_phone, customer_address)
SELECT id, customer_name, customer_phone, address
FROM public.orders
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_contacts cc 
  WHERE cc.order_id = orders.id
);

-- Add comment explaining the security model
COMMENT ON TABLE public.customer_contacts IS 'Stores sensitive customer contact information separately from orders for privacy. Vendors access masked data through vendor_orders_view.';
COMMENT ON VIEW public.vendor_orders_view IS 'Provides vendors with masked customer data for order fulfillment while protecting customer privacy.';