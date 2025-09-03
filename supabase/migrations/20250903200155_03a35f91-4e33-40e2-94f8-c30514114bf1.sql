-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_vendor_hours_vendor_day ON public.vendor_hours(vendor_id, day_of_week);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_hours ENABLE ROW LEVEL SECURITY;

-- RLS: Products are publicly viewable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Products are viewable by everyone'
  ) THEN
    CREATE POLICY "Products are viewable by everyone"
      ON public.products FOR SELECT
      USING (true);
  END IF;
END$$;

-- RLS: Vendors manage their own products or admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Vendors manage their own products'
  ) THEN
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
  END IF;
END$$;

-- RLS: Vendor hours are publicly viewable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_hours' AND policyname = 'Vendor hours are viewable by everyone'
  ) THEN
    CREATE POLICY "Vendor hours are viewable by everyone"
      ON public.vendor_hours FOR SELECT
      USING (true);
  END IF;
END$$;

-- RLS: Vendors manage their own hours or admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_hours' AND policyname = 'Vendors manage their own hours'
  ) THEN
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
  END IF;
END$$;

-- Triggers to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname = 'update_products_updated_at' AND c.relname = 'products'
  ) THEN
    CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname = 'update_vendor_hours_updated_at' AND c.relname = 'vendor_hours'
  ) THEN
    CREATE TRIGGER update_vendor_hours_updated_at
    BEFORE UPDATE ON public.vendor_hours
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Seed Vendors (if not already present)
-- Note: Assumes vendors.user_id is nullable; if not, please create users and update user_id accordingly.
INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Lapacho Pizzas', 'Pizzería', '+54 11 5555-1111', 'Av. Rivadavia 1234, CABA', true, 4.7, 1250, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Lapacho Pizzas');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Sakura Sushi', 'Sushi', '+54 11 5555-2222', 'Amenábar 456, CABA', true, 4.6, 980, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Sakura Sushi');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Burger Lapacho', 'Hamburguesería', '+54 11 5555-3333', 'Medrano 789, CABA', true, 4.5, 1120, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Burger Lapacho');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Empanadas del Norte', 'Empanadas', '+54 11 5555-4444', 'Scalabrini Ortiz 321, CABA', true, 4.4, 860, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Empanadas del Norte');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Pasta Rosa', 'Pastas', '+54 11 5555-5555', 'Córdoba 2100, CABA', true, 4.8, 740, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Pasta Rosa');

INSERT INTO public.vendors (name, category, phone, address, is_active, rating, total_orders, image, joined_at)
SELECT 'Café Lapacho', 'Cafetería', '+54 11 5555-6666', 'Dorrego 1350, CABA', true, 4.6, 630, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.name = 'Café Lapacho');

-- Seed Vendor Hours for each vendor (10-22hs daily)
INSERT INTO public.vendor_hours (vendor_id, day_of_week, open_time, close_time, is_closed)
SELECT v.id, g, time '10:00', time '22:00', false
FROM public.vendors v
JOIN generate_series(0,6) g ON true
WHERE v.name IN ('Lapacho Pizzas','Sakura Sushi','Burger Lapacho','Empanadas del Norte','Pasta Rosa','Café Lapacho')
AND NOT EXISTS (
  SELECT 1 FROM public.vendor_hours vh WHERE vh.vendor_id = v.id
);

-- Seed Products for each vendor
-- Lapacho Pizzas
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Muzzarella Clásica','Pizzas','Masa a la piedra, salsa de tomate, muzza y orégano', 5800.00),
    ('Napolitana','Pizzas','Tomate en rodajas, ajo, muzza y albahaca', 6500.00),
    ('Fugazzeta','Pizzas','Cebolla caramelizada y abundante queso', 6300.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Lapacho Pizzas'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);

-- Sakura Sushi
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Combo Clásico 12 piezas','Sushi','Niguiri, maki y california rolls', 9200.00),
    ('Sashimi Salmón 10 piezas','Sushi','Cortes de salmón fresco', 11000.00),
    ('Veggie Rolls 10 piezas','Sushi','Palta, pepino, zanahoria', 7800.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Sakura Sushi'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);

-- Burger Lapacho
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Lapacho Burger','Hamburguesas','Doble medallón, cheddar, panceta y salsa rosa', 7200.00),
    ('Cheeseburger','Hamburguesas','Clásica con cheddar y pepinillos', 6500.00),
    ('Veggie Burger','Hamburguesas','Medallón de legumbres y verduras grilladas', 6800.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Burger Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);

-- Empanadas del Norte
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Carne Suave','Empanadas','Carne cortada a cuchillo, huevo y verdeo', 1200.00),
    ('Humita','Empanadas','Choclo, queso y especias', 1150.00),
    ('Queso y Cebolla','Empanadas','Quesos seleccionados y cebolla', 1150.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Empanadas del Norte'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);

-- Pasta Rosa
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Sorrentinos de Jamón y Queso','Pastas','Con salsa rosa Lapacho', 6900.00),
    ('Ñoquis de Papa','Pastas','Con bolognesa o salsa cuatro quesos', 6400.00),
    ('Fetuccini al Pesto','Pastas','Albahaca, nuez y parmesano', 6700.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Pasta Rosa'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);

-- Café Lapacho
INSERT INTO public.products (vendor_id, name, category, description, price, image)
SELECT v.id, p.name, p.category, p.description, p.price, NULL
FROM public.vendors v
JOIN (
  VALUES
    ('Café Americano','Bebidas','Taza 250ml', 1800.00),
    ('Capuccino Lapacho','Bebidas','Con toque de rosa', 2300.00),
    ('Medialunas x2','Panadería','Manteca o grasa', 1500.00)
) AS p(name, category, description, price)
ON true
WHERE v.name = 'Café Lapacho'
AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.vendor_id = v.id);
