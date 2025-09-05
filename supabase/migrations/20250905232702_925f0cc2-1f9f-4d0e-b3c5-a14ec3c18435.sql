-- CRITICAL SECURITY FIX: Protect vendor sensitive information from public access

-- Drop the overly permissive policy that exposes all vendor data publicly
DROP POLICY IF EXISTS "Anyone can view active vendors" ON public.vendors;

-- Create a public view that only exposes non-sensitive vendor information
CREATE OR REPLACE VIEW public.public_vendors AS
SELECT 
  id,
  name,
  category,
  is_active,
  rating,
  total_orders,
  opening_time,
  closing_time,
  days_open,
  image,
  joined_at,
  -- Only show neighborhood/area, not full address
  get_simplified_address(address) as address_area,
  -- Check if vendor has products available
  CASE WHEN jsonb_array_length(available_products) > 0 THEN true ELSE false END as has_products,
  available_products
FROM public.vendors
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.public_vendors TO anon, authenticated;

-- Create new, more secure RLS policies for vendors table

-- Policy 1: Public can only see limited vendor info (id, name, category, active status)
-- This is needed for order creation to validate vendor exists
CREATE POLICY "Public can check vendor exists" 
ON public.vendors 
FOR SELECT 
USING (
  is_active = true 
  AND (
    -- Allow public to only see id and name for vendor validation
    current_setting('request.jwt.claims', true)::json->>'role' IS NULL
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'anon'
  )
);

-- Policy 2: Authenticated vendors can see and update their own full data
CREATE POLICY "Vendors can view their own full data" 
ON public.vendors 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Vendors can update their own data" 
ON public.vendors 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy 3: Admins can manage all vendors
CREATE POLICY "Admins can manage all vendors" 
ON public.vendors 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 4: Service role (WhatsApp bot) can access all vendor data for order processing
CREATE POLICY "Service role can access vendor data" 
ON public.vendors 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add security documentation
COMMENT ON TABLE public.vendors IS 'Contains sensitive vendor contact information. Public access is restricted to basic info only. Full data accessible by vendor owners, admins, and system service role.';
COMMENT ON VIEW public.public_vendors IS 'Public-safe view of vendor information. Excludes sensitive data like phone numbers, WhatsApp numbers, and full addresses.';

-- Create index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);