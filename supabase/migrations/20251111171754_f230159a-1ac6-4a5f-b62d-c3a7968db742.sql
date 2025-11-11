-- Add payment_settings column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{
  "efectivo": true,
  "transferencia": {
    "activo": false,
    "alias": null,
    "cbu": null,
    "titular": null
  },
  "mercadoPago": {
    "activo": false,
    "user_id": null,
    "access_token": null,
    "refresh_token": null,
    "fecha_expiracion_token": null
  }
}'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_payment_settings ON vendors USING GIN (payment_settings);

-- Create table to track MercadoPago token refresh
CREATE TABLE IF NOT EXISTS mercadopago_token_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on token refresh log
ALTER TABLE mercadopago_token_refresh_log ENABLE ROW LEVEL SECURITY;

-- Policy for vendors to view their own refresh logs
CREATE POLICY "Vendors can view their token refresh logs"
ON mercadopago_token_refresh_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendors
    WHERE vendors.id = mercadopago_token_refresh_log.vendor_id
    AND vendors.user_id = auth.uid()
  )
);

-- Policy for system to manage logs
CREATE POLICY "System can manage token refresh logs"
ON mercadopago_token_refresh_log
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);