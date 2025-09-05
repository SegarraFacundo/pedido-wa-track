-- Link demo users to vendors and create missing store if needed
DO $$
DECLARE vid uuid; uid uuid;
BEGIN
  -- Pizzería Don Luigi -> pizzeria@demo.com
  SELECT id INTO uid FROM auth.users WHERE email = 'pizzeria@demo.com';
  IF uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role)
    VALUES (uid, 'pizzeria@demo.com', 'vendor')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

    UPDATE public.vendors
    SET user_id = uid
    WHERE name = 'Pizzería Don Luigi';
  END IF;

  -- Farmacia San José -> farmacia@demo.com
  SELECT id INTO uid FROM auth.users WHERE email = 'farmacia@demo.com';
  IF uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role)
    VALUES (uid, 'farmacia@demo.com', 'vendor')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

    UPDATE public.vendors
    SET user_id = uid
    WHERE name = 'Farmacia San José';
  END IF;

  -- Tienda 24hs -> tienda@demo.com (create if missing)
  SELECT id INTO uid FROM auth.users WHERE email = 'tienda@demo.com';
  IF uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role)
    VALUES (uid, 'tienda@demo.com', 'vendor')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'vendor';

    -- Ensure vendor exists
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE name ILIKE 'Tienda 24hs%') THEN
      INSERT INTO public.vendors (id, user_id, name, category, phone, address, is_active, opening_time, closing_time)
      VALUES (gen_random_uuid(), uid, 'Tienda 24hs', 'market', '+54 11 3333-3333', 'Av. Siempre Abierto 789, Buenos Aires', true, '00:00:00'::time, '23:59:00'::time);
    ELSE
      UPDATE public.vendors SET user_id = uid WHERE name ILIKE 'Tienda 24hs%';
    END IF;
  END IF;
END $$;