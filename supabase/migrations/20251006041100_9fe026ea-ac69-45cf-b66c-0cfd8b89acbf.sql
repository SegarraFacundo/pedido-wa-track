-- Asignar rol de admin a tu usuario
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'segarrafacundoroman@gmail.com';
  
  IF target_user_id IS NOT NULL THEN
    -- Insert admin role if not exists
    INSERT INTO user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;