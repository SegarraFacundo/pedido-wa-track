-- Actualizar productos del vivero con categorías correctas
UPDATE products 
SET category = ARRAY['Plantas']::TEXT[]
WHERE id = '9841c51b-a6e1-4e4e-8c94-1d13e0493a19';

UPDATE products 
SET category = ARRAY['Abonos']::TEXT[]
WHERE id = 'e5511e58-64e5-477b-b25a-9e4c11f59efe';