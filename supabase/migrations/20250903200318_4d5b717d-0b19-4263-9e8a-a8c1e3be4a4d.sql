-- Allow null user_id temporarily for seeding
ALTER TABLE public.vendors ALTER COLUMN user_id DROP NOT NULL;

-- Create products table
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

-- Vendors manage their own products
CREATE POLICY "Vendors manage their own products"
  ON public.products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND (
          v.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND (
          v.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  );

-- Vendors manage their own hours
CREATE POLICY "Vendors manage their own hours"
  ON public.vendor_hours
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_hours.vendor_id
        AND (
          v.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_hours.vendor_id
        AND (
          v.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  );

-- Add triggers
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_hours_updated_at
BEFORE UPDATE ON public.vendor_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed vendors
INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at, opening_time, closing_time)
VALUES 
  ('Lapacho Pizzas', 'Pizzería', '+54 11 5555-1111', 'Av. Rivadavia 1234, CABA', true, 4.7, 1250, NULL, now(), '10:00', '22:00'),
  ('Sakura Sushi', 'Sushi', '+54 11 5555-2222', 'Amenábar 456, CABA', true, 4.6, 980, NULL, now(), '12:00', '23:00'),
  ('Burger Lapacho', 'Hamburguesería', '+54 11 5555-3333', 'Medrano 789, CABA', true, 4.5, 1120, NULL, now(), '11:00', '00:00'),
  ('Empanadas del Norte', 'Empanadas', '+54 11 5555-4444', 'Scalabrini Ortiz 321, CABA', true, 4.4, 860, NULL, now(), '10:00', '22:00'),
  ('Pasta Rosa', 'Pastas', '+54 11 5555-5555', 'Córdoba 2100, CABA', true, 4.8, 740, NULL, now(), '12:00', '23:00'),
  ('Café Lapacho', 'Cafetería', '+54 11 5555-6666', 'Dorrego 1350, CABA', true, 4.6, 630, NULL, now(), '08:00', '20:00')
ON CONFLICT (name) DO NOTHING;

-- Seed vendor hours for each vendor
INSERT INTO public.vendor_hours (vendor_id, day_of_week, open_time, close_time, is_closed)
SELECT v.id, day, 
  CASE v.name
    WHEN 'Café Lapacho' THEN '08:00'::time
    WHEN 'Burger Lapacho' THEN '11:00'::time
    WHEN 'Sakura Sushi' THEN '12:00'::time
    WHEN 'Pasta Rosa' THEN '12:00'::time
    ELSE '10:00'::time
  END,
  CASE v.name
    WHEN 'Café Lapacho' THEN '20:00'::time
    WHEN 'Burger Lapacho' THEN '00:00'::time
    WHEN 'Sakura Sushi' THEN '23:00'::time
    WHEN 'Pasta Rosa' THEN '23:00'::time
    ELSE '22:00'::time
  END,
  false
FROM public.vendors v
CROSS JOIN generate_series(0,6) day
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendor_hours vh WHERE vh.vendor_id = v.id AND vh.day_of_week = day
);

-- Seed products
INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Muzzarella Clásica', 'Pizzas', 'Masa a la piedra, salsa de tomate, muzza y orégano', 5800.00
FROM public.vendors v WHERE v.name = 'Lapacho Pizzas'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Muzzarella Clásica');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Napolitana', 'Pizzas', 'Tomate en rodajas, ajo, muzza y albahaca', 6500.00
FROM public.vendors v WHERE v.name = 'Lapacho Pizzas'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Napolitana');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Fugazzeta', 'Pizzas', 'Cebolla caramelizada y abundante queso', 6300.00
FROM public.vendors v WHERE v.name = 'Lapacho Pizzas'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Fugazzeta');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Combo Clásico 12 piezas', 'Sushi', 'Niguiri, maki y california rolls', 9200.00
FROM public.vendors v WHERE v.name = 'Sakura Sushi'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Combo Clásico 12 piezas');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Sashimi Salmón 10 piezas', 'Sushi', 'Cortes de salmón fresco', 11000.00
FROM public.vendors v WHERE v.name = 'Sakura Sushi'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Sashimi Salmón 10 piezas');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Veggie Rolls 10 piezas', 'Sushi', 'Palta, pepino, zanahoria', 7800.00
FROM public.vendors v WHERE v.name = 'Sakura Sushi'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Veggie Rolls 10 piezas');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Lapacho Burger', 'Hamburguesas', 'Doble medallón, cheddar, panceta y salsa rosa', 7200.00
FROM public.vendors v WHERE v.name = 'Burger Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Lapacho Burger');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Cheeseburger', 'Hamburguesas', 'Clásica con cheddar y pepinillos', 6500.00
FROM public.vendors v WHERE v.name = 'Burger Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Cheeseburger');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Veggie Burger', 'Hamburguesas', 'Medallón de legumbres y verduras grilladas', 6800.00
FROM public.vendors v WHERE v.name = 'Burger Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Veggie Burger');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Carne Suave', 'Empanadas', 'Carne cortada a cuchillo, huevo y verdeo', 1200.00
FROM public.vendors v WHERE v.name = 'Empanadas del Norte'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Carne Suave');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Humita', 'Empanadas', 'Choclo, queso y especias', 1150.00
FROM public.vendors v WHERE v.name = 'Empanadas del Norte'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Humita');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Queso y Cebolla', 'Empanadas', 'Quesos seleccionados y cebolla', 1150.00
FROM public.vendors v WHERE v.name = 'Empanadas del Norte'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Queso y Cebolla');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Sorrentinos de Jamón y Queso', 'Pastas', 'Con salsa rosa Lapacho', 6900.00
FROM public.vendors v WHERE v.name = 'Pasta Rosa'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Sorrentinos de Jamón y Queso');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Ñoquis de Papa', 'Pastas', 'Con bolognesa o salsa cuatro quesos', 6400.00
FROM public.vendors v WHERE v.name = 'Pasta Rosa'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Ñoquis de Papa');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Fetuccini al Pesto', 'Pastas', 'Albahaca, nuez y parmesano', 6700.00
FROM public.vendors v WHERE v.name = 'Pasta Rosa'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Fetuccini al Pesto');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Café Americano', 'Bebidas', 'Taza 250ml', 1800.00
FROM public.vendors v WHERE v.name = 'Café Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Café Americano');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Capuccino Lapacho', 'Bebidas', 'Con toque de rosa', 2300.00
FROM public.vendors v WHERE v.name = 'Café Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Capuccino Lapacho');

INSERT INTO public.products (vendor_id, name, category, description, price)
SELECT v.id, 'Medialunas x2', 'Panadería', 'Manteca o grasa', 1500.00
FROM public.vendors v WHERE v.name = 'Café Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.vendor_id = v.id AND p.name = 'Medialunas x2');