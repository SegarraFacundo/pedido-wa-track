-- Add delivery price per km to vendors table
ALTER TABLE vendors 
ADD COLUMN delivery_price_per_km NUMERIC DEFAULT 0;

COMMENT ON COLUMN vendors.delivery_price_per_km IS 'Price per kilometer for delivery in local currency';