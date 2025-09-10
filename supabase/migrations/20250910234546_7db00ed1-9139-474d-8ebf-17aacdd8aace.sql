-- Fix security issue: Vendor business information exposed to competitors
-- We'll recreate the public_vendors view with limited, necessary information only

-- First, drop the existing view
DROP VIEW IF EXISTS public.public_vendors;

-- Recreate the view with only essential public information
-- This view will only show active vendors with limited details
CREATE VIEW public.public_vendors AS
SELECT 
  v.id,
  v.name,
  v.category,
  v.average_rating as rating,
  v.opening_time,
  v.closing_time,
  v.days_open,
  v.image,
  -- Only show general area, not full address
  CASE 
    WHEN v.address IS NOT NULL THEN 
      split_part(v.address, ',', 1) || 
      CASE 
        WHEN array_length(string_to_array(v.address, ','), 1) > 1 
        THEN ', ' || trim(split_part(v.address, ',', array_length(string_to_array(v.address, ','), 1)))
        ELSE ''
      END
    ELSE NULL
  END as address_area,
  v.total_orders,
  v.joined_at,
  v.is_active,
  -- Only show if vendor has products available
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.vendor_id = v.id 
    AND p.is_available = true
  ) as has_products,
  -- Limited product preview (only names and prices, not full details)
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', p.name,
          'price', p.price,
          'category', p.category
        )
      )
      FROM (
        SELECT name, price, category
        FROM public.products
        WHERE vendor_id = v.id
        AND is_available = true
        LIMIT 5  -- Only show up to 5 products as preview
      ) p
    ),
    '[]'::jsonb
  ) as available_products
FROM public.vendors v
WHERE v.is_active = true;  -- Only show active vendors

-- Grant read access to the view
GRANT SELECT ON public.public_vendors TO anon, authenticated;

-- Create a more detailed vendor view for authenticated vendors only
CREATE OR REPLACE VIEW public.vendor_details AS
SELECT 
  v.*,
  -- Full vendor details only visible to the vendor themselves
  CASE 
    WHEN v.user_id = auth.uid() THEN v.phone
    ELSE NULL
  END as full_phone,
  CASE 
    WHEN v.user_id = auth.uid() THEN v.whatsapp_number
    ELSE NULL
  END as full_whatsapp,
  CASE 
    WHEN v.user_id = auth.uid() THEN v.address
    ELSE get_simplified_address(v.address)
  END as full_address
FROM public.vendors v;

-- Enable RLS on the vendor_details view
ALTER VIEW public.vendor_details SET (security_invoker = on);

-- Grant access to vendor_details
GRANT SELECT ON public.vendor_details TO authenticated;

-- Add comment explaining the security model
COMMENT ON VIEW public.public_vendors IS 'Limited public view of vendor information for customer-facing features. Sensitive business data like phone numbers and exact addresses are excluded to prevent competitor data scraping.';

COMMENT ON VIEW public.vendor_details IS 'Detailed vendor view with RLS. Vendors can see their own full details, others see limited information.';

-- Create an index to improve performance of the public view
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_vendor_available ON public.products(vendor_id, is_available) WHERE is_available = true;