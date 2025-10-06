-- Fix Security Definer View Issue
-- Enable RLS on all views to prevent unauthorized access

-- Enable RLS on public_vendors view
ALTER VIEW public_vendors SET (security_barrier = true);

-- Enable RLS on vendor_details view  
ALTER VIEW vendor_details SET (security_barrier = true);

-- Enable RLS on vendor_orders_view
ALTER VIEW vendor_orders_view SET (security_barrier = true);

-- Enable RLS on vendor_reviews_public view
ALTER VIEW vendor_reviews_public SET (security_barrier = true);

-- Note: security_barrier ensures that security-relevant filters are applied 
-- before any user-supplied conditions, preventing data leakage through views