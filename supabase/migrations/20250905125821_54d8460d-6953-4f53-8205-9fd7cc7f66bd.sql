-- Create example users and vendors with products

-- First, we need to create a function to safely create users
CREATE OR REPLACE FUNCTION create_test_user(
  user_email text,
  user_password text,
  vendor_name text,
  vendor_category text,
  vendor_phone text,
  vendor_address text
) RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Generate a UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users (simplified for testing)
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    raw_app_meta_data,
    aud,
    role,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    instance_id
  ) VALUES (
    new_user_id,
    user_email,
    jsonb_build_object('vendor_name', vendor_name),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    crypt(user_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '00000000-0000-0000-0000-000000000000'
  );
  
  -- Create vendor profile
  INSERT INTO public.vendors (
    user_id,
    name,
    category,
    phone,
    address,
    whatsapp_number,
    is_active
  ) VALUES (
    new_user_id,
    vendor_name,
    vendor_category,
    vendor_phone,
    vendor_address,
    vendor_phone,
    true
  );
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create test vendors
DO $$
DECLARE
  pizzeria_user_id uuid;
  pharmacy_user_id uuid;
  store_user_id uuid;
  pizzeria_vendor_id uuid;
  pharmacy_vendor_id uuid;
  store_vendor_id uuid;
BEGIN
  -- Create Pizzeria user
  pizzeria_user_id := create_test_user(
    'pizzeria@demo.com',
    'pizzeria123',
    'Pizza Express',
    'Restaurant',
    '+5491122334455',
    'Av. Corrientes 1234, CABA'
  );
  
  -- Create Pharmacy user
  pharmacy_user_id := create_test_user(
    'farmacia@demo.com',
    'farmacia123',
    'Farmacia Central',
    'Pharmacy',
    '+5491133445566',
    'Av. Santa Fe 2345, CABA'
  );
  
  -- Create Store user
  store_user_id := create_test_user(
    'tienda@demo.com',
    'tienda123',
    'Super Market 24hs',
    'Store',
    '+5491144556677',
    'Av. Rivadavia 3456, CABA'
  );
  
  -- Get vendor IDs
  SELECT id INTO pizzeria_vendor_id FROM vendors WHERE user_id = pizzeria_user_id;
  SELECT id INTO pharmacy_vendor_id FROM vendors WHERE user_id = pharmacy_user_id;
  SELECT id INTO store_vendor_id FROM vendors WHERE user_id = store_user_id;
  
  -- Add products for Pizzeria
  INSERT INTO public.products (vendor_id, name, category, price, description, is_available) VALUES
  (pizzeria_vendor_id, 'Pizza Mozzarella', 'Pizzas', 8500, 'Pizza clásica con mozzarella y salsa de tomate', true),
  (pizzeria_vendor_id, 'Pizza Napolitana', 'Pizzas', 9500, 'Pizza con mozzarella, tomate y ajo', true),
  (pizzeria_vendor_id, 'Pizza Fugazzeta', 'Pizzas', 9000, 'Pizza con cebolla y mozzarella', true),
  (pizzeria_vendor_id, 'Pizza Calabresa', 'Pizzas', 10000, 'Pizza con mozzarella y salame', true),
  (pizzeria_vendor_id, 'Empanada Carne', 'Empanadas', 1200, 'Empanada de carne cortada a cuchillo', true),
  (pizzeria_vendor_id, 'Empanada Jamón y Queso', 'Empanadas', 1200, 'Empanada de jamón y queso', true),
  (pizzeria_vendor_id, 'Coca Cola 1.5L', 'Bebidas', 2500, 'Gaseosa Coca Cola 1.5 litros', true),
  (pizzeria_vendor_id, 'Cerveza Quilmes 1L', 'Bebidas', 3000, 'Cerveza Quilmes litro', true);
  
  -- Add products for Pharmacy
  INSERT INTO public.products (vendor_id, name, category, price, description, is_available) VALUES
  (pharmacy_vendor_id, 'Ibuprofeno 400mg', 'Analgésicos', 2500, 'Caja x 10 comprimidos', true),
  (pharmacy_vendor_id, 'Paracetamol 500mg', 'Analgésicos', 1800, 'Caja x 20 comprimidos', true),
  (pharmacy_vendor_id, 'Amoxicilina 500mg', 'Antibióticos', 4500, 'Caja x 21 comprimidos - Requiere receta', true),
  (pharmacy_vendor_id, 'Alcohol en Gel 250ml', 'Higiene', 1500, 'Alcohol en gel antibacterial', true),
  (pharmacy_vendor_id, 'Barbijos x 10', 'Higiene', 2000, 'Barbijos descartables triple capa', true),
  (pharmacy_vendor_id, 'Curitas x 20', 'Primeros Auxilios', 800, 'Curitas adhesivas surtidas', true),
  (pharmacy_vendor_id, 'Termómetro Digital', 'Accesorios', 5500, 'Termómetro digital con estuche', true),
  (pharmacy_vendor_id, 'Vitamina C 500mg', 'Vitaminas', 3200, 'Vitamina C x 30 comprimidos', true);
  
  -- Add products for Store
  INSERT INTO public.products (vendor_id, name, category, price, description, is_available) VALUES
  (store_vendor_id, 'Leche Entera 1L', 'Lácteos', 1200, 'Leche entera La Serenísima', true),
  (store_vendor_id, 'Pan Lactal Blanco', 'Panadería', 1800, 'Pan lactal Bimbo grande', true),
  (store_vendor_id, 'Yerba Mate 1kg', 'Almacén', 3500, 'Yerba mate Amanda 1kg', true),
  (store_vendor_id, 'Fideos Spaghetti 500g', 'Almacén', 1500, 'Fideos Matarazzo spaghetti', true),
  (store_vendor_id, 'Aceite Girasol 1.5L', 'Almacén', 2800, 'Aceite de girasol Cocinero', true),
  (store_vendor_id, 'Azúcar 1kg', 'Almacén', 1900, 'Azúcar blanca Ledesma', true),
  (store_vendor_id, 'Jabón en Polvo 800g', 'Limpieza', 2600, 'Jabón en polvo Skip', true),
  (store_vendor_id, 'Papel Higiénico x 4', 'Limpieza', 2200, 'Papel higiénico Elite doble hoja', true);
  
  -- Add vendor hours for all vendors
  INSERT INTO public.vendor_hours (vendor_id, day_of_week, opening_time, closing_time, is_closed) VALUES
  -- Pizzeria hours
  (pizzeria_vendor_id, 'monday', '18:00', '23:30', false),
  (pizzeria_vendor_id, 'tuesday', '18:00', '23:30', false),
  (pizzeria_vendor_id, 'wednesday', '18:00', '23:30', false),
  (pizzeria_vendor_id, 'thursday', '18:00', '23:30', false),
  (pizzeria_vendor_id, 'friday', '18:00', '00:30', false),
  (pizzeria_vendor_id, 'saturday', '18:00', '00:30', false),
  (pizzeria_vendor_id, 'sunday', '18:00', '23:00', false),
  
  -- Pharmacy hours
  (pharmacy_vendor_id, 'monday', '08:00', '20:00', false),
  (pharmacy_vendor_id, 'tuesday', '08:00', '20:00', false),
  (pharmacy_vendor_id, 'wednesday', '08:00', '20:00', false),
  (pharmacy_vendor_id, 'thursday', '08:00', '20:00', false),
  (pharmacy_vendor_id, 'friday', '08:00', '20:00', false),
  (pharmacy_vendor_id, 'saturday', '09:00', '13:00', false),
  (pharmacy_vendor_id, 'sunday', '09:00', '13:00', true),
  
  -- Store 24hs
  (store_vendor_id, 'monday', '00:00', '23:59', false),
  (store_vendor_id, 'tuesday', '00:00', '23:59', false),
  (store_vendor_id, 'wednesday', '00:00', '23:59', false),
  (store_vendor_id, 'thursday', '00:00', '23:59', false),
  (store_vendor_id, 'friday', '00:00', '23:59', false),
  (store_vendor_id, 'saturday', '00:00', '23:59', false),
  (store_vendor_id, 'sunday', '00:00', '23:59', false);
END $$;

-- Clean up the function
DROP FUNCTION create_test_user;