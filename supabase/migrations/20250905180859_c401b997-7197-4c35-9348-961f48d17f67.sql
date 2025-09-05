-- Upsert demo vendors with valid categories
INSERT INTO public.vendors (id, name, category, phone, address, is_active, opening_time, closing_time)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'Pizzería La Demo', 'restaurant', '+54 11 1111-1111', 'Av. Demo 123, Buenos Aires', true, '11:00:00'::time, '23:00:00'::time),
  ('b2222222-2222-2222-2222-222222222222', 'Farmacia San José', 'pharmacy', '+54 11 2222-2222', 'Calle Salud 456, Buenos Aires', true, '08:00:00'::time, '22:00:00'::time),
  ('c3333333-3333-3333-3333-333333333333', 'Tienda 24hs Express', 'market', '+54 11 3333-3333', 'Av. Siempre Abierto 789, Buenos Aires', true, '00:00:00'::time, '23:59:00'::time)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_active = true,
  opening_time = EXCLUDED.opening_time,
  closing_time = EXCLUDED.closing_time;

-- Create or get users and link to vendors
DO $$
DECLARE uid uuid;
BEGIN
  -- Pizzería user
  SELECT id INTO uid FROM auth.users WHERE email = 'pizzeria@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user('{"email":"pizzeria@demo.com","password":"pizzeria123","email_confirm": true}'::jsonb)).id INTO uid;
  END IF;
  INSERT INTO public.profiles (id, email, role) VALUES (uid, 'pizzeria@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';
  UPDATE public.vendors SET user_id = uid WHERE id = 'a1111111-1111-1111-1111-111111111111';

  -- Farmacia user
  SELECT id INTO uid FROM auth.users WHERE email = 'farmacia@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user('{"email":"farmacia@demo.com","password":"farmacia123","email_confirm": true}'::jsonb)).id INTO uid;
  END IF;
  INSERT INTO public.profiles (id, email, role) VALUES (uid, 'farmacia@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';
  UPDATE public.vendors SET user_id = uid WHERE id = 'b2222222-2222-2222-2222-222222222222';

  -- Tienda user
  SELECT id INTO uid FROM auth.users WHERE email = 'tienda@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user('{"email":"tienda@demo.com","password":"tienda123","email_confirm": true}'::jsonb)).id INTO uid;
  END IF;
  INSERT INTO public.profiles (id, email, role) VALUES (uid, 'tienda@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';
  UPDATE public.vendors SET user_id = uid WHERE id = 'c3333333-3333-3333-3333-333333333333';
END $$;

-- Seed products (idempotent)
INSERT INTO public.products (vendor_id, name, category, price, is_available)
SELECT * FROM (VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Pizza Mozzarella', 'Pizzas', 8500, true),
  ('a1111111-1111-1111-1111-111111111111', 'Pizza Napolitana', 'Pizzas', 9500, true),
  ('a1111111-1111-1111-1111-111111111111', 'Empanada de Carne', 'Empanadas', 1200, true),
  ('a1111111-1111-1111-1111-111111111111', 'Coca Cola 1.5L', 'Bebidas', 2500, true),
  ('b2222222-2222-2222-2222-222222222222', 'Ibuprofeno 400mg', 'Medicamentos', 2800, true),
  ('b2222222-2222-2222-2222-222222222222', 'Paracetamol 500mg', 'Medicamentos', 2200, true),
  ('b2222222-2222-2222-2222-222222222222', 'Alcohol en Gel', 'Higiene', 1800, true),
  ('b2222222-2222-2222-2222-222222222222', 'Barbijo KN95', 'Higiene', 850, true),
  ('c3333333-3333-3333-3333-333333333333', 'Leche 1L', 'Lácteos', 1500, true),
  ('c3333333-3333-3333-3333-333333333333', 'Pan Lactal', 'Panadería', 2100, true),
  ('c3333333-3333-3333-3333-333333333333', 'Cerveza Quilmes 1L', 'Bebidas', 2800, true),
  ('c3333333-3333-3333-3333-333333333333', 'Papas Fritas', 'Snacks', 3200, true)
) AS v(vendor_id, name, category, price, is_available)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p 
  WHERE p.vendor_id = v.vendor_id AND p.name = v.name
);
