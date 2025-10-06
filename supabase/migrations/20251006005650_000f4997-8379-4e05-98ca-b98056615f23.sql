-- Fix RLS policies to use has_role consistently across all admin tables

-- Update vendors policies
DROP POLICY IF EXISTS "Admins manage vendors" ON vendors;
CREATE POLICY "Admins manage vendors"
ON vendors
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update commission_settings policies (already correct, but ensuring consistency)
DROP POLICY IF EXISTS "Admins can manage commission settings" ON commission_settings;
CREATE POLICY "Admins can manage commission settings"
ON commission_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update vendor_commissions policies (already correct)
DROP POLICY IF EXISTS "Admins can manage all commissions" ON vendor_commissions;
CREATE POLICY "Admins can manage all commissions"
ON vendor_commissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update customer_contacts policies
DROP POLICY IF EXISTS "Admins can view customer contacts" ON customer_contacts;
CREATE POLICY "Admins can view customer contacts"
ON customer_contacts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update customer contacts" ON customer_contacts;
CREATE POLICY "Admins can update customer contacts"
ON customer_contacts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can create customer contacts" ON customer_contacts;
CREATE POLICY "Admins can create customer contacts"
ON customer_contacts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update chat_sessions policies
DROP POLICY IF EXISTS "Admins can view chat sessions" ON chat_sessions;
CREATE POLICY "Admins can view chat sessions"
ON chat_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update vendor_reviews policies
DROP POLICY IF EXISTS "Admins can view all reviews" ON vendor_reviews;
CREATE POLICY "Admins can view all reviews"
ON vendor_reviews
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));