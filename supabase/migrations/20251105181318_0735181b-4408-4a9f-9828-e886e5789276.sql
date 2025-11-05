-- Add column to track manual address entry
ALTER TABLE saved_addresses 
ADD COLUMN IF NOT EXISTS is_manual_entry boolean NOT NULL DEFAULT false;

-- Add column to orders to track manual addresses
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS address_is_manual boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN saved_addresses.is_manual_entry IS 'True when address was entered manually without GPS coordinates';
COMMENT ON COLUMN orders.address_is_manual IS 'True when order address was entered manually without GPS validation';