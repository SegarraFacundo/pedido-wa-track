-- Primero, modificar la columna user_id para permitir NULL temporalmente
ALTER TABLE vendors ALTER COLUMN user_id DROP NOT NULL;

-- Limpiar datos existentes
TRUNCATE vendors, products, vendor_hours CASCADE;

-- Insertar vendors con user_id NULL
INSERT INTO vendors (id, name, category, phone, whatsapp_number, address, is_active, rating, total_orders, image, user_id) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizzería Don Luigi', 'restaurant', '+595971234567', '+595971234567', 'Av. España 1234, Asunción', true, 4.8, 1250, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38', NULL),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Burger House', 'restaurant', '+595982345678', '+595982345678', 'Av. Mariscal López 5678, Asunción', true, 4.6, 890, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd', NULL),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Farmacia San José', 'pharmacy', '+595993456789', '+595993456789', 'Av. San Martín 910, Asunción', true, 4.9, 2100, 'https://images.unsplash.com/photo-1576602976047-174e57a47881', NULL),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Supermercado El Ahorro', 'market', '+595974567890', '+595974567890', 'Av. Artigas 1112, Asunción', true, 4.5, 3200, 'https://images.unsplash.com/photo-1542838132-92c53300491e', NULL),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Heladería Italiana', 'restaurant', '+595985678901', '+595985678901', 'Shopping del Sol, Asunción', true, 4.7, 670, 'https://images.unsplash.com/photo-1563589173312-476d8c36b242', NULL),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Lapacho Restaurant', 'restaurant', '+595996789012', '+595996789012', 'Av. Santa Teresa 2345, Asunción', true, 4.9, 1450, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0', NULL);

-- Insertar vendor hours
INSERT INTO vendor_hours (vendor_id, day_of_week, opening_time, closing_time, is_closed) VALUES
-- Pizzería Don Luigi
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'monday', '11:00', '23:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'tuesday', '11:00', '23:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'wednesday', '11:00', '23:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'thursday', '11:00', '23:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'friday', '11:00', '00:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'saturday', '11:00', '00:00', false),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sunday', '11:00', '22:00', false),

-- Burger House
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'monday', '10:00', '23:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'tuesday', '10:00', '23:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'wednesday', '10:00', '23:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'thursday', '10:00', '23:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'friday', '10:00', '01:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'saturday', '10:00', '01:00', false),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'sunday', '11:00', '22:00', false),

-- Farmacia San José
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'monday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'tuesday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'wednesday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'thursday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'friday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'saturday', '07:00', '22:00', false),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'sunday', '08:00', '20:00', false),

-- Supermercado El Ahorro
('d4e5f6a7-b8c9-0123-defa-456789012345', 'monday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'tuesday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'wednesday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'thursday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'friday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'saturday', '08:00', '21:00', false),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'sunday', '09:00', '19:00', false),

-- Heladería Italiana
('e5f6a7b8-c9d0-1234-efab-567890123456', 'monday', '10:00', '22:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'tuesday', '10:00', '22:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'wednesday', '10:00', '22:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'thursday', '10:00', '22:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'friday', '10:00', '23:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'saturday', '10:00', '23:00', false),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'sunday', '11:00', '21:00', false),

-- Lapacho Restaurant
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'monday', '00:00', '00:00', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'tuesday', '12:00', '15:00', false),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'wednesday', '12:00', '15:00', false),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'thursday', '12:00', '15:00', false),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'friday', '12:00', '15:00', false),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'saturday', '12:00', '15:00', false),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'sunday', '12:00', '23:00', false);

-- Insertar products
INSERT INTO products (vendor_id, name, category, price, description, is_available) VALUES
-- Pizzería Don Luigi
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Margherita', 'Pizzas Clásicas', 35000, 'Salsa de tomate, mozzarella, albahaca fresca', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Pepperoni', 'Pizzas Clásicas', 45000, 'Salsa de tomate, mozzarella, pepperoni', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Cuatro Quesos', 'Pizzas Especiales', 50000, 'Mozzarella, gorgonzola, parmesano, provolone', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Lasagna Bolognesa', 'Pastas', 42000, 'Lasagna con salsa bolognesa y bechamel', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Spaghetti Carbonara', 'Pastas', 38000, 'Spaghetti con salsa carbonara tradicional', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tiramisú', 'Postres', 18000, 'Postre italiano tradicional', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Coca Cola 1L', 'Bebidas', 8000, 'Bebida gaseosa', true),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Agua Mineral', 'Bebidas', 5000, 'Agua mineral 500ml', true),

-- Burger House
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Classic Burger', 'Hamburguesas', 28000, 'Carne, lechuga, tomate, cebolla, salsa especial', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Bacon Burger', 'Hamburguesas', 35000, 'Carne, bacon, queso cheddar, cebolla caramelizada', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Veggie Burger', 'Hamburguesas', 25000, 'Hamburguesa vegetariana con vegetales grillados', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Papas Fritas', 'Acompañamientos', 12000, 'Papas fritas crujientes', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Onion Rings', 'Acompañamientos', 15000, 'Aros de cebolla empanizados', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Milkshake Chocolate', 'Bebidas', 18000, 'Batido de chocolate', true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Cerveza Artesanal', 'Bebidas', 15000, 'Cerveza artesanal local', true),

-- Farmacia San José
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Paracetamol 500mg', 'Analgésicos', 15000, 'Caja x 20 comprimidos', true),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Ibuprofeno 400mg', 'Analgésicos', 18000, 'Caja x 20 comprimidos', true),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Vitamina C', 'Vitaminas', 25000, 'Frasco x 30 comprimidos', true),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Alcohol en Gel', 'Higiene', 12000, 'Frasco 250ml', true),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Barbijos N95', 'Protección', 5000, 'Unidad', true),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Termómetro Digital', 'Equipos Médicos', 45000, 'Termómetro digital infrarrojo', true),

-- Supermercado El Ahorro
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Leche Entera 1L', 'Lácteos', 8500, 'Leche entera pasteurizada', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Pan Francés', 'Panadería', 5000, 'Pan francés fresco del día', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Arroz 1kg', 'Despensa', 12000, 'Arroz tipo 1', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Aceite de Girasol 1L', 'Despensa', 18000, 'Aceite de girasol refinado', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Manzanas Rojas 1kg', 'Frutas', 15000, 'Manzanas rojas frescas', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Carne Molida 500g', 'Carnicería', 25000, 'Carne molida especial', true),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'Detergente 500ml', 'Limpieza', 12000, 'Detergente líquido concentrado', true),

-- Heladería Italiana
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Helado de Chocolate', 'Helados Clásicos', 8000, 'Copa de helado de chocolate belga', true),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Helado de Vainilla', 'Helados Clásicos', 8000, 'Copa de helado de vainilla', true),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Helado de Frutilla', 'Helados Frutales', 8000, 'Copa de helado de frutilla natural', true),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Sundae Especial', 'Especialidades', 15000, 'Helado con toppings y salsas', true),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Banana Split', 'Especialidades', 22000, 'Clásico banana split con 3 sabores', true),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'Milkshake', 'Bebidas', 12000, 'Batido de helado a elección', true),

-- Lapacho Restaurant
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Sopa Paraguaya', 'Entradas', 15000, 'Porción tradicional de sopa paraguaya', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Chipa Guazú', 'Entradas', 18000, 'Pastel de choclo tradicional', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Asado con Mandioca', 'Platos Principales', 55000, 'Asado de tira con mandioca hervida', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Surubí a la Parrilla', 'Platos Principales', 65000, 'Surubí grillado con ensalada', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Bife de Chorizo', 'Platos Principales', 58000, 'Bife de chorizo con guarnición', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Mbeju', 'Acompañamientos', 12000, 'Tortilla de almidón y queso', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Tereré Ruso', 'Bebidas', 8000, 'Bebida fría tradicional', true),
('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Clericó', 'Bebidas', 15000, 'Bebida con frutas', true);