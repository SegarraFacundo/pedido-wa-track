-- Fix SECURITY DEFINER function issue
-- Recreate get_order_customer_details without SECURITY DEFINER

-- Drop the existing function with SECURITY DEFINER
DROP FUNCTION IF EXISTS public.get_order_customer_details(uuid);

-- Recreate the function without SECURITY DEFINER (using default SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_order_customer_details(order_id_param uuid)
 RETURNS TABLE(customer_name text, customer_phone text, customer_address text)
 LANGUAGE plpgsql
 -- Removed SECURITY DEFINER here
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION public.get_order_customer_details(uuid) IS 'Returns customer details for an order, using SECURITY INVOKER to respect RLS policies';