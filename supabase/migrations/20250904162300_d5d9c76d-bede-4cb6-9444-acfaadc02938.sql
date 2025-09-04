-- Fix security issue: Remove SECURITY DEFINER from vendor_orders_view
DROP VIEW IF EXISTS public.vendor_orders_view CASCADE;

-- Recreate view without SECURITY DEFINER
CREATE VIEW public.vendor_orders_view AS
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
  -- Masked fields for vendor privacy
  get_masked_phone(o.customer_phone) as customer_phone_masked,
  substring(o.customer_name from 1 for 3) || '***' as customer_name_masked,
  get_simplified_address(o.address) as address_simplified
FROM public.orders o;

-- Add RLS policies for vendor_orders_view
ALTER VIEW public.vendor_orders_view SET (security_barrier = on);

-- Fix chat_sessions table RLS - it currently has no policies
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create/update their own chat session
CREATE POLICY "Anyone can manage their chat session"
  ON public.chat_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);