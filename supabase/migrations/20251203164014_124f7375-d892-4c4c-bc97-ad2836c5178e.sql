-- Add allows_delivery column to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS allows_delivery BOOLEAN DEFAULT true;

-- Update all existing vendors to have delivery enabled by default
UPDATE vendors SET allows_delivery = true WHERE allows_delivery IS NULL;

-- Add comment
COMMENT ON COLUMN vendors.allows_delivery IS 'Indicates if vendor offers delivery service';