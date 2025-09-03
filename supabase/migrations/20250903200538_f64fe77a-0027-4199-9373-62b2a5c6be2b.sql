-- Create products table first
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_hours table
CREATE TABLE IF NOT EXISTS public.vendor_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_vendor_hours_vendor_day ON public.vendor_hours(vendor_id, day_of_week);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_hours ENABLE ROW LEVEL SECURITY;

-- Products are publicly viewable
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  USING (true);

-- Vendor hours are publicly viewable
CREATE POLICY "Vendor hours are viewable by everyone"
  ON public.vendor_hours FOR SELECT
  USING (true);

-- Add triggers
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_hours_updated_at
BEFORE UPDATE ON public.vendor_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Now insert vendors
DELETE FROM public.vendors WHERE name IN ('Lapacho Pizzas', 'Sakura Sushi', 'Burger Lapacho', 'Empanadas del Norte', 'Pasta Rosa', 'Café Lapacho');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at, opening_time, closing_time)
VALUES 
  ('Lapacho Pizzas', 'Pizzería', '+54 11 5555-1111', 'Av. Rivadavia 1234, CABA', true, 4.7, 1250, NULL, now(), '10:00', '22:00'),
  ('Sakura Sushi', 'Sushi', '+54 11 5555-2222', 'Amenábar 456, CABA', true, 4.6, 980, NULL, now(), '12:00', '23:00'),
  ('Burger Lapacho', 'Hamburguesería', '+54 11 5555-3333', 'Medrano 789, CABA', true, 4.5, 1120, NULL, now(), '11:00', '00:00'),
  ('Empanadas del Norte', 'Empanadas', '+54 11 5555-4444', 'Scalabrini Ortiz 321, CABA', true, 4.4, 860, NULL, now(), '10:00', '22:00'),
  ('Pasta Rosa', 'Pastas', '+54 11 5555-5555', 'Córdoba 2100, CABA', true, 4.8, 740, NULL, now(), '12:00', '23:00'),
  ('Café Lapacho', 'Cafetería', '+54 11 5555-6666', 'Dorrego 1350, CABA', true, 4.6, 630, NULL, now(), '08:00', '20:00');

-- Insert vendor hours
INSERT INTO public.vendor_hours (vendor_id, day_of_week, open_time, close_time, is_closed)
SELECT v.id, day, v.opening_time::time, v.closing_time::time, false
FROM public.vendors v
CROSS JOIN generate_series(0,6) day
WHERE v.name IN ('Lapacho Pizzas', 'Sakura Sushi', 'Burger Lapacho', 'Empanadas del Norte', 'Pasta Rosa', 'Café Lapacho');

-- Insert all products
INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, p.name, p.category, p.description, p.price
FROM public.vendors v
JOIN (VALUES
  -- Lapacho Pizzas
  ('Lapacho Pizzas', 'Muzzarella Clásica', 'Pizzas', 'Masa a la piedra, salsa de tomate, muzza y orégano', 5800.00),
  ('Lapacho Pizzas', 'Napolitana', 'Pizzas', 'Tomate en rodajas, ajo, muzza y albahaca', 6500.00),
  ('Lapacho Pizzas', 'Fugazzeta', 'Pizzas', 'Cebolla caramelizada y abundante queso', 6300.00),
  ('Lapacho Pizzas', 'Pepperoni', 'Pizzas', 'Pepperoni artesanal, muzza y pimientos', 6800.00),
  ('Lapacho Pizzas', 'Cuatro Quesos', 'Pizzas', 'Muzzarella, gorgonzola, parmesano y fontina', 7200.00),
  
  -- Sakura Sushi
  ('Sakura Sushi', 'Combo Clásico 12 piezas', 'Sushi', 'Niguiri, maki y california rolls', 9200.00),
  ('Sakura Sushi', 'Sashimi Salmón 10 piezas', 'Sushi', 'Cortes de salmón fresco', 11000.00),
  ('Sakura Sushi', 'Veggie Rolls 10 piezas', 'Sushi', 'Palta, pepino, zanahoria', 7800.00),
  ('Sakura Sushi', 'Combo Premium 20 piezas', 'Sushi', 'Variedad premium con langostinos', 15500.00),
  ('Sakura Sushi', 'Temaki Salmón', 'Sushi', 'Cono de alga con salmón y palta', 3200.00),
  
  -- Burger Lapacho
  ('Burger Lapacho', 'Lapacho Burger', 'Hamburguesas', 'Doble medallón, cheddar, panceta y salsa rosa', 7200.00),
  ('Burger Lapacho', 'Cheeseburger', 'Hamburguesas', 'Clásica con cheddar y pepinillos', 6500.00),
  ('Burger Lapacho', 'Veggie Burger', 'Hamburguesas', 'Medallón de legumbres y verduras grilladas', 6800.00),
  ('Burger Lapacho', 'BBQ Bacon', 'Hamburguesas', 'Con salsa BBQ, bacon crispy y aros de cebolla', 7500.00),
  ('Burger Lapacho', 'Papas Fritas', 'Acompañamientos', 'Papas fritas clásicas con sal', 2800.00),
  
  -- Empanadas del Norte
  ('Empanadas del Norte', 'Carne Suave', 'Empanadas', 'Carne cortada a cuchillo, huevo y verdeo', 1200.00),
  ('Empanadas del Norte', 'Humita', 'Empanadas', 'Choclo, queso y especias', 1150.00),
  ('Empanadas del Norte', 'Queso y Cebolla', 'Empanadas', 'Quesos seleccionados y cebolla', 1150.00),
  ('Empanadas del Norte', 'Pollo', 'Empanadas', 'Pollo desmenuzado con verduras', 1200.00),
  ('Empanadas del Norte', 'Jamón y Queso', 'Empanadas', 'Jamón cocido y muzzarella', 1150.00),
  ('Empanadas del Norte', 'Docena Mixta', 'Promociones', '12 empanadas a elección', 12000.00),
  
  -- Pasta Rosa
  ('Pasta Rosa', 'Sorrentinos de Jamón y Queso', 'Pastas', 'Con salsa rosa Lapacho', 6900.00),
  ('Pasta Rosa', 'Ñoquis de Papa', 'Pastas', 'Con bolognesa o salsa cuatro quesos', 6400.00),
  ('Pasta Rosa', 'Fetuccini al Pesto', 'Pastas', 'Albahaca, nuez y parmesano', 6700.00),
  ('Pasta Rosa', 'Ravioles de Ricota', 'Pastas', 'Rellenos de ricota y espinaca', 6500.00),
  ('Pasta Rosa', 'Lasaña Bolognesa', 'Pastas', 'Capas de pasta con carne y bechamel', 7800.00),
  
  -- Café Lapacho
  ('Café Lapacho', 'Café Americano', 'Bebidas', 'Taza 250ml', 1800.00),
  ('Café Lapacho', 'Capuccino Lapacho', 'Bebidas', 'Con toque de rosa', 2300.00),
  ('Café Lapacho', 'Medialunas x2', 'Panadería', 'Manteca o grasa', 1500.00),
  ('Café Lapacho', 'Tostado Mixto', 'Sandwiches', 'Jamón y queso en pan árabe', 3200.00),
  ('Café Lapacho', 'Cheesecake', 'Postres', 'Con frutos rojos', 2800.00),
  ('Café Lapacho', 'Flat White', 'Bebidas', 'Café con leche texturizada', 2500.00)
) AS p(vendor_name, name, category, description, price)
ON v.name = p.vendor_name;