-- Enable authentication for vendors
CREATE OR REPLACE FUNCTION public.handle_vendor_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for vendor users
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'vendor');
  
  RETURN NEW;
END;
$$;

-- Create trigger for vendor signups
CREATE TRIGGER on_vendor_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'role' = 'vendor')
  EXECUTE FUNCTION public.handle_vendor_signup();