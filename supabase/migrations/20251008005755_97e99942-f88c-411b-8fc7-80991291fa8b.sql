-- Create user account for Lapacho Restaurant and link to vendor
DO $$
DECLARE
  new_user_id UUID;
  vendor_uuid UUID := 'f6a7b8c9-d0e1-2345-fabc-678901234567';
BEGIN
  -- Insert user into auth.users (this is a simplified approach)
  -- In production, you should use Supabase Auth API
  -- For now, we'll create a placeholder and you'll need to create the actual user through the Auth UI or API
  
  -- Check if vendor exists
  IF NOT EXISTS (SELECT 1 FROM vendors WHERE id = vendor_uuid) THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;
  
  -- Note: You cannot directly insert into auth.users via SQL for security reasons
  -- You need to use the Supabase Auth API or Dashboard to create the user
  RAISE NOTICE 'Please create user with email: restaurant@example.com and password: restaurant123 through Supabase Dashboard';
  RAISE NOTICE 'Then run: UPDATE vendors SET user_id = (SELECT id FROM auth.users WHERE email = ''restaurant@example.com'') WHERE id = ''f6a7b8c9-d0e1-2345-fabc-678901234567''';
END $$;

-- Create a helper function to link vendor to user after user creation
CREATE OR REPLACE FUNCTION public.link_vendor_to_user(vendor_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  vendor_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = vendor_email;
  
  IF target_user_id IS NULL THEN
    RETURN 'Usuario no encontrado con email: ' || vendor_email;
  END IF;
  
  -- Get vendor without user_id
  SELECT id INTO vendor_id
  FROM vendors
  WHERE phone = '+595996789012' AND user_id IS NULL;
  
  IF vendor_id IS NULL THEN
    RETURN 'Vendedor no encontrado o ya tiene usuario asignado';
  END IF;
  
  -- Update vendor with user_id
  UPDATE vendors
  SET user_id = target_user_id
  WHERE id = vendor_id;
  
  -- Insert vendor role if not exists
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'vendor')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN 'Usuario vinculado exitosamente al vendedor Lapacho Restaurant';
END;
$$;