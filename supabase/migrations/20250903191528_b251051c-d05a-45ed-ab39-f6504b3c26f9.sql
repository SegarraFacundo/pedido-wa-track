-- Fix security warnings for the functions

-- Update get_masked_phone function with proper search_path
CREATE OR REPLACE FUNCTION public.get_masked_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL OR length(phone) < 4 THEN
    RETURN '****';
  END IF;
  RETURN '****' || substring(phone from length(phone) - 3);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Update get_simplified_address function with proper search_path
CREATE OR REPLACE FUNCTION public.get_simplified_address(full_address TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Return only the first part of the address (usually area/neighborhood)
  RETURN split_part(full_address, ',', 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Update get_order_customer_details function to include search_path
CREATE OR REPLACE FUNCTION public.get_order_customer_details(order_id_param UUID)
RETURNS TABLE (
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT
) 
SECURITY DEFINER
SET search_path = public
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

-- Update update_updated_at_column function with search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update handle_new_user function with search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer');
    RETURN NEW;
END;
$$;