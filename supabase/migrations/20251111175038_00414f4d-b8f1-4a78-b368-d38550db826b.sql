-- Create platform_reviews table for reviews about Lapacho platform
CREATE TABLE IF NOT EXISTS public.platform_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL CHECK (user_type IN ('vendor', 'customer')),
  reviewer_name TEXT NOT NULL,
  reviewer_phone TEXT NOT NULL,
  reviewer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can create reviews
CREATE POLICY "Anyone can create platform reviews"
  ON public.platform_reviews
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all reviews
CREATE POLICY "Admins can view all platform reviews"
  ON public.platform_reviews
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Vendors can view their own reviews
CREATE POLICY "Vendors can view their own platform reviews"
  ON public.platform_reviews
  FOR SELECT
  USING (
    user_type = 'vendor' AND 
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.user_id = auth.uid() 
      AND vendors.phone = platform_reviews.reviewer_phone
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_platform_reviews_updated_at
  BEFORE UPDATE ON public.platform_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_platform_reviews_created_at ON public.platform_reviews(created_at DESC);
CREATE INDEX idx_platform_reviews_rating ON public.platform_reviews(rating);