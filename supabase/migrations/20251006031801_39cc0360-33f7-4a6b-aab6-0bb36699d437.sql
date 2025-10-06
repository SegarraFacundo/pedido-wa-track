-- Add image column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS image TEXT;

-- Add image column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;

-- Create storage bucket for vendor images
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-images', 'vendor-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vendor images
CREATE POLICY "Anyone can view vendor images"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-images');

CREATE POLICY "Vendors can upload their images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vendor-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update their images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vendor-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can delete their images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vendor-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Vendors can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
  )
);