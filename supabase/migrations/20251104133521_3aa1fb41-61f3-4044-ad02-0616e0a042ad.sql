-- Arreglar productos con categorías como array doble
-- Convertir [["Plantas"]] a ["Plantas"]

UPDATE products
SET category = (
  SELECT array_agg(DISTINCT elem)
  FROM unnest(category) AS arr_elem,
       unnest(arr_elem::text[]) AS elem
)
WHERE jsonb_typeof(to_jsonb(category[1])) = 'array';

-- Asegurar que no haya nulls en arrays
UPDATE products 
SET category = ARRAY[]::text[]
WHERE category IS NULL;