-- Create example vendors with real data
INSERT INTO public.vendors (id, name, category, phone, whatsapp_number, address, is_active, rating, opening_time, closing_time, days_open)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Express', 'restaurant', '+54911234567890', '+54911234567890', 'Av. Corrientes 1234, CABA', true, 4.5, '11:00', '23:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Farmacia Salud', 'pharmacy', '+54911234567891', '+54911234567891', 'Av. Santa Fe 5678, CABA', true, 4.8, '08:00', '22:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Supermercado El Ahorro', 'market', '+54911234567892', '+54911234567892', 'Av. Rivadavia 9012, CABA', true, 4.2, '08:00', '21:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

-- Create products for Pizza Express
INSERT INTO public.products (vendor_id, name, category, description, price, is_available)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Mozzarella', 'Pizzas', 'Pizza clásica con mozzarella', 8500, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Napolitana', 'Pizzas', 'Con tomate y albahaca fresca', 9500, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Fugazzeta', 'Pizzas', 'Con cebolla y queso', 9000, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Coca Cola 1.5L', 'Bebidas', 'Gaseosa línea Coca Cola', 2500, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Papas Fritas', 'Acompañamientos', 'Porción grande de papas fritas', 3500, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Empanadas (docena)', 'Entradas', 'Carne, pollo o jamón y queso', 7000, true);

-- Create products for Farmacia Salud
INSERT INTO public.products (vendor_id, name, category, description, price, is_available)
VALUES 
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Ibuprofeno 400mg', 'Analgésicos', 'Caja x 10 comprimidos', 1500, true),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Paracetamol 500mg', 'Analgésicos', 'Caja x 20 comprimidos', 1200, true),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Alcohol en Gel', 'Higiene', 'Frasco 250ml', 800, true),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Barbijos x 10', 'Protección', 'Caja con 10 unidades', 500, true),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Curitas', 'Primeros Auxilios', 'Caja x 20 unidades', 600, true);

-- Create products for Supermercado El Ahorro
INSERT INTO public.products (vendor_id, name, category, description, price, is_available)
VALUES 
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Leche La Serenísima 1L', 'Lácteos', 'Leche entera', 850, true),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Pan Lactal Bimbo', 'Panadería', 'Pan de molde blanco', 1200, true),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Fideos Matarazzo 500g', 'Almacén', 'Spaghetti', 750, true),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Aceite Cocinero 900ml', 'Almacén', 'Aceite de girasol', 1400, true),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Yerba Amanda 1kg', 'Almacén', 'Yerba mate con palo', 2200, true),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Azúcar Ledesma 1kg', 'Almacén', 'Azúcar blanca refinada', 900, true);

-- Create vendor hours for each vendor
INSERT INTO public.vendor_hours (vendor_id, day_of_week, opening_time, closing_time, is_closed)
VALUES 
  -- Pizza Express
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'monday', '11:00', '23:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'tuesday', '11:00', '23:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'wednesday', '11:00', '23:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'thursday', '11:00', '23:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'friday', '11:00', '00:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'saturday', '11:00', '00:00', false),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sunday', '11:00', '23:00', false),
  -- Farmacia Salud
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'monday', '08:00', '22:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'tuesday', '08:00', '22:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'wednesday', '08:00', '22:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'thursday', '08:00', '22:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'friday', '08:00', '22:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'saturday', '09:00', '20:00', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'sunday', '09:00', '13:00', true),
  -- Supermercado El Ahorro
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'monday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'tuesday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'wednesday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'thursday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'friday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'saturday', '08:00', '21:00', false),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'sunday', '09:00', '19:00', false);