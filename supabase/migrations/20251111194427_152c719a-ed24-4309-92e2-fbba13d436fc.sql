-- Hacer público el bucket payment-receipts
UPDATE storage.buckets 
SET public = true 
WHERE id = 'payment-receipts';