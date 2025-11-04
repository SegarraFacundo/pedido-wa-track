-- Primero, eliminar la vista que depende de la columna
DROP VIEW IF EXISTS public_vendors CASCADE;

-- Modificar el campo category de productos para soportar múltiples categorías
-- Primero, crear una nueva columna temporal con array
ALTER TABLE products ADD COLUMN categories TEXT[];

-- Migrar datos existentes: convertir la categoría actual en un array de un elemento
UPDATE products SET categories = ARRAY[category] WHERE category IS NOT NULL;

-- Eliminar la columna antigua
ALTER TABLE products DROP COLUMN category;

-- Renombrar la nueva columna
ALTER TABLE products RENAME COLUMN categories TO category;

-- Crear índice GIN para búsquedas eficientes en arrays
CREATE INDEX IF NOT EXISTS idx_products_category ON products USING GIN(category);

-- Recrear la vista public_vendors con la nueva estructura
CREATE OR REPLACE VIEW public_vendors AS
SELECT 
  v.id,
  v.name,
  v.category,
  v.image,
  v.rating,
  v.total_orders,
  v.is_active,
  v.joined_at,
  v.address AS address_area,
  v.opening_time,
  v.closing_time,
  v.days_open,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'price', p.price,
          'category', p.category,
          'image', p.image
        )
      )
      FROM products p
      WHERE p.vendor_id = v.id AND p.is_available = true
    ),
    '[]'::jsonb
  ) as available_products,
  EXISTS(
    SELECT 1 FROM products p 
    WHERE p.vendor_id = v.id AND p.is_available = true
  ) as has_products
FROM vendors v
WHERE v.is_active = true;