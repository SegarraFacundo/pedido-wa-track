-- Fix Security Definer View Issue
-- Enable SECURITY INVOKER mode so views respect RLS policies of the querying user

-- Enable SECURITY INVOKER on public_vendors view
ALTER VIEW public_vendors SET (security_invoker = on);

-- Enable SECURITY INVOKER on vendor_details view  
ALTER VIEW vendor_details SET (security_invoker = on);

-- Enable SECURITY INVOKER on vendor_orders_view
ALTER VIEW vendor_orders_view SET (security_invoker = on);

-- Enable SECURITY INVOKER on vendor_reviews_public view
ALTER VIEW vendor_reviews_public SET (security_invoker = on);

-- This ensures views execute with the privileges of the calling user,
-- respecting RLS policies and preventing unintentional privilege escalation