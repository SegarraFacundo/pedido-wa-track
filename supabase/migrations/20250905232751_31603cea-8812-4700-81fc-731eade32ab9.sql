-- CRITICAL SECURITY FIX: Protect vendor sensitive information from public access

-- First, drop ALL existing vendor policies to start fresh
DROP POLICY IF EXISTS "Anyone can view active vendors" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can update their own data" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors" ON public.vendors;

-- Create a public view that only exposes non-sensitive vendor information
DROP VIEW IF EXISTS public.public_vendors;
CREATE VIEW public.public_vendors AS
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

-- Policy 1: Authenticated vendors can see their own full data
CREATE POLICY "Vendors can view own data" 
ON public.vendors 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Authenticated vendors can update their own data
CREATE POLICY "Vendors can update own data" 
ON public.vendors 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy 3: Admins can do everything with vendors
CREATE POLICY "Admins manage vendors" 
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

-- Policy 4: Service role (WhatsApp bot) can read all vendor data for order processing
-- This is critical for the WhatsApp bot to function
CREATE POLICY "System can read vendors" 
ON public.vendors 
FOR SELECT 
USING (
  -- Allow service role or when no JWT is present (for edge functions with service role key)
  auth.jwt() IS NULL 
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- Add security documentation
COMMENT ON TABLE public.vendors IS 'Contains sensitive vendor contact information. Public access removed for security. Full data accessible by vendor owners, admins, and system service role only.';
COMMENT ON VIEW public.public_vendors IS 'Public-safe view of vendor information. Excludes sensitive data like phone numbers, WhatsApp numbers, and full addresses. Use this for public vendor listings.';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);