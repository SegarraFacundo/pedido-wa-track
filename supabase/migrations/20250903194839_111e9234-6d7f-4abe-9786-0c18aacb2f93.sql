-- Primero, insertar algunos usuarios de prueba en profiles
INSERT INTO public.profiles (id, email, full_name, role, phone) VALUES
  ('d0d0d0d0-0001-0001-0001-000000000001'::uuid, 'admin@lapacho.com', 'Admin Lapacho', 'admin', '+5491112345678'),
  ('d0d0d0d0-0002-0002-0002-000000000002'::uuid, 'pizzeria@lapacho.com', 'Pizzería La Nueva', 'vendor', '+5491123456789'),
  ('d0d0d0d0-0003-0003-0003-000000000003'::uuid, 'sushi@lapacho.com', 'Sushi Express', 'vendor', '+5491134567890'),
  ('d0d0d0d0-0004-0004-0004-000000000004'::uuid, 'burger@lapacho.com', 'Burger King Local', 'vendor', '+5491145678901'),
  ('d0d0d0d0-0005-0005-0005-000000000005'::uuid, 'farmacia@lapacho.com', 'Farmacia Central', 'vendor', '+5491156789012'),
  ('d0d0d0d0-0006-0006-0006-000000000006'::uuid, 'cafe@lapacho.com', 'Café Delicias', 'vendor', '+5491167890123')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone;

-- Insertar vendedores con productos detallados
INSERT INTO public.vendors (id, name, category, phone, whatsapp_number, address, is_active, rating, total_orders, opening_time, closing_time, days_open, available_products, user_id) VALUES
  ('v0000001-0001-0001-0001-000000000001'::uuid, 'Pizzería La Nueva', 'restaurant', '+5491123456789', '+5491123456789', 'Av. San Martín 1234, Centro', true, 4.8, 245, '11:00:00', '23:30:00', 
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
   '[
     {"category": "🍕 Pizzas Clásicas", "items": [
       {"name": "Mozzarella", "price": 2800, "description": "Salsa de tomate y mozzarella"},
       {"name": "Napolitana", "price": 3200, "description": "Tomate, mozzarella y ajo"},
       {"name": "Fugazzeta", "price": 3000, "description": "Cebolla y mozzarella"},
       {"name": "Calabresa", "price": 3500, "description": "Mozzarella y longaniza"}
     ]},
     {"category": "🍕 Pizzas Especiales", "items": [
       {"name": "4 Quesos", "price": 3800, "description": "Mozzarella, roquefort, parmesano y fontina"},
       {"name": "Rúcula y Jamón Crudo", "price": 4200, "description": "Mozzarella, rúcula, jamón crudo y parmesano"},
       {"name": "Vegetariana", "price": 3400, "description": "Verduras de estación"}
     ]},
     {"category": "🥤 Bebidas", "items": [
       {"name": "Coca Cola 1.5L", "price": 900},
       {"name": "Sprite 1.5L", "price": 900},
       {"name": "Agua Mineral 500ml", "price": 400},
       {"name": "Cerveza Quilmes 1L", "price": 1200}
     ]},
     {"category": "🍮 Postres", "items": [
       {"name": "Flan Casero", "price": 800},
       {"name": "Tiramisú", "price": 1200},
       {"name": "Helado 1/4 kg", "price": 1500}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0002-0002-0002-000000000002'::uuid),

  ('v0000002-0002-0002-0002-000000000002'::uuid, 'Sushi Express', 'restaurant', '+5491134567890', '+5491134567890', 'Av. Libertador 567, Norte', true, 4.6, 189, '12:00:00', '23:00:00',
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
   '[
     {"category": "🍣 Rolls Clásicos", "items": [
       {"name": "Philadelphia Roll (8u)", "price": 2500},
       {"name": "California Roll (8u)", "price": 2400},
       {"name": "New York Roll (8u)", "price": 2800},
       {"name": "Sake Roll (8u)", "price": 2200}
     ]},
     {"category": "🍱 Combinados", "items": [
       {"name": "Combo 15 piezas", "price": 3500},
       {"name": "Combo 30 piezas", "price": 6500},
       {"name": "Combo Premium 40 piezas", "price": 9000}
     ]},
     {"category": "🥟 Entradas", "items": [
       {"name": "Gyozas (6u)", "price": 1500},
       {"name": "Edamame", "price": 900},
       {"name": "Tempura de Verduras", "price": 1800}
     ]},
     {"category": "🥤 Bebidas", "items": [
       {"name": "Té Verde", "price": 500},
       {"name": "Sake", "price": 2000},
       {"name": "Coca Cola Zero", "price": 600}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0003-0003-0003-000000000003'::uuid),

  ('v0000003-0003-0003-0003-000000000003'::uuid, 'Burger House', 'restaurant', '+5491145678901', '+5491145678901', 'Calle Belgrano 890, Oeste', true, 4.7, 312, '11:30:00', '00:00:00',
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
   '[
     {"category": "🍔 Hamburguesas", "items": [
       {"name": "Clásica", "price": 2200, "description": "Carne, lechuga, tomate, cebolla"},
       {"name": "Cheese Burger", "price": 2500, "description": "Carne, cheddar x2"},
       {"name": "Bacon Burger", "price": 2900, "description": "Carne, bacon, cheddar"},
       {"name": "Veggie Burger", "price": 2100, "description": "Medallón de lentejas"}
     ]},
     {"category": "🍟 Acompañamientos", "items": [
       {"name": "Papas Fritas", "price": 900},
       {"name": "Papas con Cheddar y Bacon", "price": 1400},
       {"name": "Aros de Cebolla", "price": 1100}
     ]},
     {"category": "🥤 Bebidas", "items": [
       {"name": "Línea Coca Cola 500ml", "price": 600},
       {"name": "Limonada", "price": 700},
       {"name": "Cerveza Artesanal", "price": 1000}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0004-0004-0004-000000000004'::uuid),

  ('v0000004-0004-0004-0004-000000000004'::uuid, 'Farmacia Central', 'pharmacy', '+5491156789012', '+5491156789012', 'Av. 9 de Julio 234, Centro', true, 4.9, 567, '08:00:00', '22:00:00',
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
   '[
     {"category": "💊 Medicamentos Sin Receta", "items": [
       {"name": "Ibuprofeno 400mg x20", "price": 800},
       {"name": "Paracetamol 500mg x20", "price": 600},
       {"name": "Aspirina 500mg x20", "price": 700},
       {"name": "Antiacido x12", "price": 900}
     ]},
     {"category": "🧴 Cuidado Personal", "items": [
       {"name": "Shampoo Head & Shoulders", "price": 1500},
       {"name": "Crema Dental Colgate", "price": 800},
       {"name": "Desodorante Rexona", "price": 1200},
       {"name": "Jabón Dove", "price": 400}
     ]},
     {"category": "🩹 Primeros Auxilios", "items": [
       {"name": "Curitas x20", "price": 300},
       {"name": "Alcohol 500ml", "price": 500},
       {"name": "Algodón 100g", "price": 400},
       {"name": "Gasa Estéril", "price": 600}
     ]},
     {"category": "👶 Bebés", "items": [
       {"name": "Pañales Pampers x30", "price": 2500},
       {"name": "Leche Nan 1", "price": 3200},
       {"name": "Óleo Calcáreo", "price": 800}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0005-0005-0005-000000000005'::uuid),

  ('v0000005-0005-0005-0005-000000000005'::uuid, 'Café Delicias', 'restaurant', '+5491167890123', '+5491167890123', 'Plaza Principal 123, Centro', true, 4.5, 423, '07:00:00', '21:00:00',
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
   '[
     {"category": "☕ Cafetería", "items": [
       {"name": "Espresso", "price": 500},
       {"name": "Cappuccino", "price": 700},
       {"name": "Latte", "price": 800},
       {"name": "Café con Leche", "price": 600}
     ]},
     {"category": "🥐 Panadería", "items": [
       {"name": "Medialunas (x3)", "price": 600},
       {"name": "Tostado Jamón y Queso", "price": 1200},
       {"name": "Sandwich de Miga (x3)", "price": 1000},
       {"name": "Croissant", "price": 500}
     ]},
     {"category": "🍰 Tortas y Postres", "items": [
       {"name": "Cheesecake", "price": 1200},
       {"name": "Brownie con Helado", "price": 1400},
       {"name": "Lemon Pie", "price": 1100},
       {"name": "Chocotorta", "price": 1000}
     ]},
     {"category": "🥤 Bebidas Frías", "items": [
       {"name": "Limonada", "price": 600},
       {"name": "Jugo de Naranja Natural", "price": 700},
       {"name": "Licuado de Frutas", "price": 900},
       {"name": "Frappé", "price": 1000}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0006-0006-0006-000000000006'::uuid),

  ('v0000006-0006-0006-0006-000000000006'::uuid, 'Supermercado 24hs', 'market', '+5491178901234', '+5491178901234', 'Av. Corrientes 456, Sur', true, 4.3, 891, '00:00:00', '23:59:59',
   ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
   '[
     {"category": "🥛 Lácteos", "items": [
       {"name": "Leche La Serenísima 1L", "price": 600},
       {"name": "Yogurt Activia", "price": 400},
       {"name": "Queso Cremoso x kg", "price": 2800},
       {"name": "Manteca 200g", "price": 800}
     ]},
     {"category": "🥖 Panadería", "items": [
       {"name": "Pan Francés x kg", "price": 800},
       {"name": "Pan Lactal Bimbo", "price": 900},
       {"name": "Facturas x kg", "price": 2000}
     ]},
     {"category": "🥩 Carnicería", "items": [
       {"name": "Asado x kg", "price": 3500},
       {"name": "Milanesas x kg", "price": 3200},
       {"name": "Pollo x kg", "price": 1800}
     ]},
     {"category": "🍺 Bebidas", "items": [
       {"name": "Pack Coca Cola x6", "price": 3000},
       {"name": "Vino Tinto", "price": 1500},
       {"name": "Cerveza Brahma x6", "price": 3600}
     ]}
   ]'::jsonb,
   'd0d0d0d0-0001-0001-0001-000000000001'::uuid)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  phone = EXCLUDED.phone,
  whatsapp_number = EXCLUDED.whatsapp_number,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  rating = EXCLUDED.rating,
  total_orders = EXCLUDED.total_orders,
  opening_time = EXCLUDED.opening_time,
  closing_time = EXCLUDED.closing_time,
  days_open = EXCLUDED.days_open,
  available_products = EXCLUDED.available_products;