-- Function to create first admin user
-- Execute this after signing up with your email at /admin-auth

-- First, you need to sign up at /admin-auth with your email and password
-- Then, find your user_id by running: SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- Finally, insert your admin role:

-- Example usage (replace with your actual user_id after signup):
-- INSERT INTO user_roles (user_id, role) 
-- SELECT id, 'admin'::app_role 
-- FROM auth.users 
-- WHERE email = 'tu-email@example.com';

-- Or create a helper function to make it easier:
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS TEXT
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
  
  -- Check if already admin
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'admin') THEN
    RETURN 'El usuario ya es administrador';
  END IF;
  
  -- Insert admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'admin');
  
  RETURN 'Usuario ' || user_email || ' ahora es administrador';
END;
$$;

-- Now you can simply run after signing up:
-- SELECT public.make_user_admin('tu-email@ejemplo.com');