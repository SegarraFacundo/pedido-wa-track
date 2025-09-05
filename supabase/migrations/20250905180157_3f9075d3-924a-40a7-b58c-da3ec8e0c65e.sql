-- Create demo users and vendor profiles
-- Note: We'll create basic profiles and vendor entries
-- Users need to be created via Supabase Dashboard or they can register via the app

-- First, let's ensure we have the vendors with proper data
-- Pizzería
INSERT INTO public.vendors (id, name, category, phone, address, is_active, opening_time, closing_time)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'Pizzería La Demo',
  'pizzeria',
  '+54 11 1111-1111',
  'Av. Demo 123, Buenos Aires',
  true,
  '11:00:00'::time,
  '23:00:00'::time
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = true;

-- Add products for pizzería
INSERT INTO public.products (vendor_id, name, category, price, is_available)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'Pizza Mozzarella', 'Pizzas', 8500, true),
  ('a1111111-1111-1111-1111-111111111111', 'Pizza Napolitana', 'Pizzas', 9500, true),
  ('a1111111-1111-1111-1111-111111111111', 'Empanada de Carne', 'Empanadas', 1200, true),
  ('a1111111-1111-1111-1111-111111111111', 'Coca Cola 1.5L', 'Bebidas', 2500, true)
ON CONFLICT DO NOTHING;

-- Farmacia
INSERT INTO public.vendors (id, name, category, phone, address, is_active, opening_time, closing_time)
VALUES (
  'b2222222-2222-2222-2222-222222222222',
  'Farmacia San José',
  'pharmacy',
  '+54 11 2222-2222',
  'Calle Salud 456, Buenos Aires',
  true,
  '08:00:00'::time,
  '22:00:00'::time
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = true;

-- Add products for farmacia
INSERT INTO public.products (vendor_id, name, category, price, is_available)
VALUES 
  ('b2222222-2222-2222-2222-222222222222', 'Ibuprofeno 400mg', 'Medicamentos', 2800, true),
  ('b2222222-2222-2222-2222-222222222222', 'Paracetamol 500mg', 'Medicamentos', 2200, true),
  ('b2222222-2222-2222-2222-222222222222', 'Alcohol en Gel', 'Higiene', 1800, true),
  ('b2222222-2222-2222-2222-222222222222', 'Barbijo KN95', 'Higiene', 850, true)
ON CONFLICT DO NOTHING;

-- Tienda 24hs
INSERT INTO public.vendors (id, name, category, phone, address, is_active, opening_time, closing_time)
VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'Tienda 24hs Express',
  'convenience',
  '+54 11 3333-3333',
  'Av. Siempre Abierto 789, Buenos Aires',
  true,
  '00:00:00'::time,
  '23:59:00'::time
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = true;

-- Add products for tienda
INSERT INTO public.products (vendor_id, name, category, price, is_available)
VALUES 
  ('c3333333-3333-3333-3333-333333333333', 'Leche 1L', 'Lácteos', 1500, true),
  ('c3333333-3333-3333-3333-333333333333', 'Pan Lactal', 'Panadería', 2100, true),
  ('c3333333-3333-3333-3333-333333333333', 'Cerveza Quilmes 1L', 'Bebidas', 2800, true),
  ('c3333333-3333-3333-3333-333333333333', 'Papas Fritas', 'Snacks', 3200, true)
ON CONFLICT DO NOTHING;

-- Add vendor hours for all
INSERT INTO public.vendor_hours (vendor_id, day_of_week, opening_time, closing_time, is_closed)
VALUES 
  -- Pizzería (closed Mondays)
  ('a1111111-1111-1111-1111-111111111111', 'monday', '11:00:00', '23:00:00', true),
  ('a1111111-1111-1111-1111-111111111111', 'tuesday', '11:00:00', '23:00:00', false),
  ('a1111111-1111-1111-1111-111111111111', 'wednesday', '11:00:00', '23:00:00', false),
  ('a1111111-1111-1111-1111-111111111111', 'thursday', '11:00:00', '23:00:00', false),
  ('a1111111-1111-1111-1111-111111111111', 'friday', '11:00:00', '00:00:00', false),
  ('a1111111-1111-1111-1111-111111111111', 'saturday', '11:00:00', '00:00:00', false),
  ('a1111111-1111-1111-1111-111111111111', 'sunday', '11:00:00', '23:00:00', false),
  -- Farmacia (open all days)
  ('b2222222-2222-2222-2222-222222222222', 'monday', '08:00:00', '22:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'tuesday', '08:00:00', '22:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'wednesday', '08:00:00', '22:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'thursday', '08:00:00', '22:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'friday', '08:00:00', '22:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'saturday', '09:00:00', '20:00:00', false),
  ('b2222222-2222-2222-2222-222222222222', 'sunday', '09:00:00', '14:00:00', false),
  -- Tienda 24hs (always open)
  ('c3333333-3333-3333-3333-333333333333', 'monday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'tuesday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'wednesday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'thursday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'friday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'saturday', '00:00:00', '23:59:00', false),
  ('c3333333-3333-3333-3333-333333333333', 'sunday', '00:00:00', '23:59:00', false)
ON CONFLICT DO NOTHING;