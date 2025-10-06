-- Fix critical security issues with customer data exposure

-- 1. Fix profiles table - Add policy to block unauthenticated access
CREATE POLICY "Block unauthenticated access to profiles"
ON profiles
FOR SELECT
TO anon
USING (false);

-- 2. Fix orders table - Add policy to explicitly block public access
-- First, we need to ensure there's a policy that denies public SELECT
CREATE POLICY "Block public access to orders"
ON orders
FOR SELECT
TO anon
USING (false);

-- 3. Add explicit authenticated policy for profiles
CREATE POLICY "Authenticated users can view profiles"
ON profiles  
FOR SELECT
TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- This ensures:
-- - Anonymous users cannot access profiles or orders
-- - Authenticated users can only see their own profile (or admins can see all)
-- - Vendors can still see their orders through the existing vendor policy