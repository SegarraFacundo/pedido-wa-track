-- Fix SECURITY DEFINER view issue
-- Recreate vendor_orders_view without SECURITY DEFINER property

-- Drop the existing view
DROP VIEW IF EXISTS public.vendor_orders_view;

-- Recreate the view without SECURITY DEFINER (using default SECURITY INVOKER)
CREATE VIEW public.vendor_orders_view AS
SELECT 
    id,
    vendor_id,
    status,
    items,
    total,
    notes,
    delivery_person_name,
    delivery_person_phone,
    created_at,
    updated_at,
    estimated_delivery,
    coordinates,
    get_masked_phone(customer_phone) AS customer_phone_masked,
    SUBSTRING(customer_name FROM 1 FOR 3) || '***'::text AS customer_name_masked,
    get_simplified_address(address) AS address_simplified
FROM public.orders o;

-- Grant appropriate permissions
GRANT SELECT ON public.vendor_orders_view TO anon;
GRANT SELECT ON public.vendor_orders_view TO authenticated;
GRANT SELECT ON public.vendor_orders_view TO service_role;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.vendor_orders_view IS 'Provides a masked view of orders for vendors, hiding sensitive customer information';