-- Create demo vendor users if missing, link to vendors
-- Pizzería
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'pizzeria@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user(
      email => 'pizzeria@demo.com',
      password => 'pizzeria123',
      email_confirm => true
    )).id INTO uid;
  END IF;

  -- Ensure profile with vendor role
  INSERT INTO public.profiles (id, email, role)
  VALUES (uid, 'pizzeria@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

  -- Link to existing pizzería vendor or create one
  IF EXISTS (SELECT 1 FROM public.vendors WHERE user_id = uid) THEN
    -- already linked
  ELSIF EXISTS (SELECT 1 FROM public.vendors WHERE user_id IS NULL AND name ILIKE 'pizzer%') THEN
    UPDATE public.vendors SET user_id = uid WHERE id = (
      SELECT id FROM public.vendors WHERE user_id IS NULL AND name ILIKE 'pizzer%' LIMIT 1
    );
  ELSE
    INSERT INTO public.vendors (user_id, name, category, phone, address, is_active)
    VALUES (uid, 'Pizzería Demo', 'pizzeria', '+54 11 1111-1111', 'Av. Demo 123', true);
  END IF;
END $$;

-- Farmacia
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'farmacia@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user(
      email => 'farmacia@demo.com',
      password => 'farmacia123',
      email_confirm => true
    )).id INTO uid;
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (uid, 'farmacia@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

  IF EXISTS (SELECT 1 FROM public.vendors WHERE user_id = uid) THEN
    -- already linked
  ELSIF EXISTS (SELECT 1 FROM public.vendors WHERE user_id IS NULL AND name ILIKE 'farmac%') THEN
    UPDATE public.vendors SET user_id = uid WHERE id = (
      SELECT id FROM public.vendors WHERE user_id IS NULL AND name ILIKE 'farmac%' LIMIT 1
    );
  ELSE
    INSERT INTO public.vendors (user_id, name, category, phone, address, is_active)
    VALUES (uid, 'Farmacia Demo', 'pharmacy', '+54 11 2222-2222', 'Calle Salud 456', true);
  END IF;
END $$;

-- Tienda 24hs
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'tienda@demo.com';
  IF uid IS NULL THEN
    SELECT (auth.create_user(
      email => 'tienda@demo.com',
      password => 'tienda123',
      email_confirm => true
    )).id INTO uid;
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (uid, 'tienda@demo.com', 'vendor')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE user_id = uid) THEN
    INSERT INTO public.vendors (user_id, name, category, phone, address, is_active)
    VALUES (uid, 'Tienda 24hs Demo', 'convenience', '+54 11 3333-3333', 'Av. Siempre Abierto 789', true);
  END IF;
END $$;
