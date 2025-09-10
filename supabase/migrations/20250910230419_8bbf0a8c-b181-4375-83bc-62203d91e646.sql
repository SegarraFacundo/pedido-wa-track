-- Fix security issue: Customer personal information exposed in vendor_reviews table

-- First, drop the existing policy that exposes all data
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.vendor_reviews;

-- Create a view that masks sensitive customer information
CREATE OR REPLACE VIEW public.vendor_reviews_public AS
SELECT 
  id,
  vendor_id,
  rating,
  comment,
  -- Mask customer name to show only first name and initial
  CASE 
    WHEN customer_name IS NOT NULL AND customer_name != '' THEN
      CONCAT(
        SPLIT_PART(customer_name, ' ', 1), 
        ' ',
        CASE 
          WHEN ARRAY_LENGTH(STRING_TO_ARRAY(customer_name, ' '), 1) > 1 
          THEN CONCAT(UPPER(SUBSTRING(SPLIT_PART(customer_name, ' ', 2), 1, 1)), '.')
          ELSE ''
        END
      )
    ELSE 'Anonymous'
  END as customer_name,
  -- Completely hide phone number from public view
  NULL::text as customer_phone,
  created_at
FROM public.vendor_reviews;

-- Grant public access to the masked view
GRANT SELECT ON public.vendor_reviews_public TO anon, authenticated;

-- Create new RLS policies for the vendor_reviews table
-- Policy 1: Vendors can see full details of reviews for their own business
CREATE POLICY "Vendors can view full details of their reviews" 
ON public.vendor_reviews 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_reviews.vendor_id 
    AND vendors.user_id = auth.uid()
  )
);

-- Policy 2: Admins can view all reviews with full details
CREATE POLICY "Admins can view all reviews" 
ON public.vendor_reviews 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- The existing INSERT policy is fine - anyone can create reviews
-- But let's ensure it's properly defined
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.vendor_reviews;
CREATE POLICY "Anyone can create reviews" 
ON public.vendor_reviews 
FOR INSERT 
WITH CHECK (true);

-- Add comment to the view for documentation
COMMENT ON VIEW public.vendor_reviews_public IS 'Public view of vendor reviews with masked customer information for privacy protection';

-- Create an index on vendor_id for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_id ON public.vendor_reviews(vendor_id);