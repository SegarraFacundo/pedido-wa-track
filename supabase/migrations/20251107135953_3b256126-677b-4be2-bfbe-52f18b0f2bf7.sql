-- Add delivery pricing configuration columns to vendors table
ALTER TABLE vendors 
ADD COLUMN delivery_pricing_type TEXT DEFAULT 'per_km' CHECK (delivery_pricing_type IN ('fixed', 'base_plus_km', 'per_km')),
ADD COLUMN delivery_fixed_price NUMERIC DEFAULT 0,
ADD COLUMN delivery_additional_per_km NUMERIC DEFAULT 0;

COMMENT ON COLUMN vendors.delivery_pricing_type IS 'Tipo de cobro: fixed (monto fijo), base_plus_km (base + adicional por km), per_km (por km total)';
COMMENT ON COLUMN vendors.delivery_fixed_price IS 'Precio fijo de delivery o precio base del primer km';
COMMENT ON COLUMN vendors.delivery_additional_per_km IS 'Precio adicional por km después del primer km (solo para base_plus_km)';