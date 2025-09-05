-- Ensure vendor_orders_view is explicitly created with SECURITY INVOKER
-- Drop and recreate to make absolutely sure it has no SECURITY DEFINER properties

DROP VIEW IF EXISTS public.vendor_orders_view CASCADE;

-- Explicitly create with SECURITY INVOKER (default)
CREATE VIEW public.vendor_orders_view 
WITH (security_invoker = true) AS
SELECT 
    o.id,
    o.vendor_id,
    o.status,
    o.items,
    o.total,
    o.notes,
    o.delivery_person_name,
    o.delivery_person_phone,
    o.created_at,
    o.updated_at,
    o.estimated_delivery,
    o.coordinates,
    get_masked_phone(o.customer_phone) AS customer_phone_masked,
    SUBSTRING(o.customer_name FROM 1 FOR 3) || '***'::text AS customer_name_masked,
    get_simplified_address(o.address) AS address_simplified
FROM public.orders o;

-- Grant appropriate permissions
GRANT SELECT ON public.vendor_orders_view TO anon;
GRANT SELECT ON public.vendor_orders_view TO authenticated;
GRANT SELECT ON public.vendor_orders_view TO service_role;

-- Add comment
COMMENT ON VIEW public.vendor_orders_view IS 'Provides a masked view of orders for vendors, hiding sensitive customer information with SECURITY INVOKER';