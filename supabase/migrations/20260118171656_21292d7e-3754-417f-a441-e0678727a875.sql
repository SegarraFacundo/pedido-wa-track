-- Drop existing policies that use profiles.role
DROP POLICY IF EXISTS "Admins can view platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can update platform settings" ON platform_settings;

-- Create new policies using the has_role function
CREATE POLICY "Admins can view platform settings"
ON platform_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update platform settings"
ON platform_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));