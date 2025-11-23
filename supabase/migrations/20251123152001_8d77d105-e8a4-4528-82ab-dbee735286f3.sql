-- Add pickup functionality to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS allows_pickup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;

-- Add delivery type to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_type TEXT CHECK (delivery_type IN ('delivery', 'pickup')) DEFAULT 'delivery';

-- Add comment for clarity
COMMENT ON COLUMN vendors.allows_pickup IS 'Indicates if vendor accepts pickup orders (retiro en local)';
COMMENT ON COLUMN vendors.pickup_instructions IS 'Instructions for customers when picking up orders';
COMMENT ON COLUMN orders.delivery_type IS 'Type of order: delivery (envío) or pickup (retiro en local)';