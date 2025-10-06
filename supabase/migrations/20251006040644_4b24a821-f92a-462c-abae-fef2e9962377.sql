-- Función para hacer un usuario soporte
CREATE OR REPLACE FUNCTION public.make_user_soporte(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RETURN 'Usuario no encontrado con email: ' || user_email;
  END IF;
  
  -- Check if already has soporte role
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'soporte') THEN
    RETURN 'El usuario ya tiene rol de soporte';
  END IF;
  
  -- Insert soporte role
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'soporte')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN 'Usuario ' || user_email || ' ahora tiene rol de soporte';
END;
$$;