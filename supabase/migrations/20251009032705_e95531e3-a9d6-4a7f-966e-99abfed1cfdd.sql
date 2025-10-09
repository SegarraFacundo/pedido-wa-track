-- Add payment receipt URL to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

-- Create storage bucket for payment receipts if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can view payment receipts for their orders" ON storage.objects;
DROP POLICY IF EXISTS "System can manage payment receipts" ON storage.objects;

-- Allow authenticated users to upload payment receipts
CREATE POLICY "Anyone can upload payment receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-receipts');

-- Allow vendors to view payment receipts for their orders
CREATE POLICY "Vendors can view payment receipts for their orders"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'payment-receipts' 
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE v.user_id = auth.uid()
    AND storage.objects.name LIKE o.id::text || '%'
  )
);

-- Allow system to manage payment receipts
CREATE POLICY "System can manage payment receipts"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'payment-receipts' 
  AND (auth.jwt()->>'role')::text = 'service_role'
);