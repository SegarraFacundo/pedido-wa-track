-- Mejorar tabla de reviews para incluir más detalles
ALTER TABLE vendor_reviews
ADD COLUMN IF NOT EXISTS delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
ADD COLUMN IF NOT EXISTS service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
ADD COLUMN IF NOT EXISTS product_rating INTEGER CHECK (product_rating >= 1 AND product_rating <= 5),
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Hacer el campo rating nullable ya que ahora tendremos ratings específicos
ALTER TABLE vendor_reviews
ALTER COLUMN rating DROP NOT NULL;

-- Crear índice para buscar reviews por pedido
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_order_id ON vendor_reviews(order_id);