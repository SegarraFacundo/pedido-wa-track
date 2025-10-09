-- Agregar campos de stock a la tabla products
-- stock_enabled: indica si el producto tiene control de stock
-- stock_quantity: cantidad disponible en stock (null si no tiene control)

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT null;

-- Crear índice para mejorar búsquedas de productos con stock
CREATE INDEX IF NOT EXISTS idx_products_stock 
ON public.products(stock_enabled, stock_quantity) 
WHERE stock_enabled = true;

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.products.stock_enabled IS 'Indica si el producto tiene control de stock habilitado';
COMMENT ON COLUMN public.products.stock_quantity IS 'Cantidad disponible en stock. NULL si stock_enabled es false';