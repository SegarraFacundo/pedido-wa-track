-- Fix Security Definer View issue
-- Explicitly recreate public_vendors view with SECURITY INVOKER to resolve linter warning

-- Drop the existing view
DROP VIEW IF EXISTS public.public_vendors CASCADE;

-- Recreate with explicit SECURITY INVOKER (which is the default, but we make it explicit)
CREATE VIEW public.public_vendors 
WITH (security_invoker = true) AS
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

-- Add documentation
COMMENT ON VIEW public.public_vendors IS 'Public-safe view of vendor information with explicit SECURITY INVOKER. Excludes sensitive data like phone numbers, WhatsApp numbers, and full addresses.';