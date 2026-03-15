
-- 1. Fix order_payments: restrict "System can manage payments" to service_role only
DROP POLICY IF EXISTS "System can manage payments" ON public.order_payments;
CREATE POLICY "System can manage payments"
  ON public.order_payments FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- 2. Fix vendor_reviews_public: recreate without customer_phone and with security_invoker
DROP VIEW IF EXISTS public.vendor_reviews_public;
CREATE VIEW public.vendor_reviews_public
WITH (security_invoker=on) AS
  SELECT
    vr.id,
    vr.vendor_id,
    vr.rating,
    vr.comment,
    vr.created_at,
    CASE
      WHEN vr.customer_name IS NOT NULL THEN LEFT(vr.customer_name, 1) || '***'
      ELSE 'Anónimo'
    END AS customer_name
  FROM public.vendor_reviews vr;

-- 3. Fix profiles privilege escalation: add WITH CHECK to block role changes
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- 4. Fix bot_error_logs: use has_role instead of profiles.role check
DROP POLICY IF EXISTS "Admins can view error logs" ON public.bot_error_logs;
CREATE POLICY "Admins can view error logs"
  ON public.bot_error_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update error logs" ON public.bot_error_logs;
CREATE POLICY "Admins can update error logs"
  ON public.bot_error_logs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix payment-receipts bucket: make private
UPDATE storage.buckets SET public = false WHERE id = 'payment-receipts';

-- 6. Fix orders: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Service role can create orders"
  ON public.orders FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- 7. Fix SECURITY DEFINER functions: add auth checks

-- 7a. get_order_customer_details - add authorization
CREATE OR REPLACE FUNCTION public.get_order_customer_details(order_id_param uuid)
 RETURNS TABLE(customer_name text, customer_phone text, customer_address text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM orders o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE o.id = order_id_param
      AND v.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(cc.customer_name, o.customer_name),
    COALESCE(cc.customer_phone, o.customer_phone),
    COALESCE(cc.customer_address, o.address)
  FROM public.orders o
  LEFT JOIN public.customer_contacts cc ON cc.order_id = o.id
  WHERE o.id = order_id_param;
END;
$function$;

-- 7b. change_order_status - add vendor auth check
CREATE OR REPLACE FUNCTION public.change_order_status(p_order_id uuid, p_new_status text, p_changed_by text, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_vendor_id UUID;
BEGIN
  SELECT status, vendor_id INTO v_current_status, v_vendor_id
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Authorization check
  IF NOT (
    (auth.jwt() ->> 'role')::text = 'service_role'
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM vendors WHERE id = v_vendor_id AND user_id = auth.uid())
  ) THEN
    RETURN FALSE;
  END IF;

  IF p_changed_by = 'customer' AND p_new_status = 'cancelled' THEN
    IF v_current_status NOT IN ('pending', 'confirmed') THEN RETURN FALSE; END IF;
  END IF;

  UPDATE orders SET status = p_new_status, updated_at = NOW() WHERE id = p_order_id;
  INSERT INTO order_status_history (order_id, status, changed_by, reason) VALUES (p_order_id, p_new_status, p_changed_by, p_reason);
  RETURN TRUE;
END;
$function$;

-- 7c. make_user_admin - require existing admin
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN 'No autorizado: se requiere rol de administrador';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  IF target_user_id IS NULL THEN RETURN 'Usuario no encontrado con email: ' || user_email; END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'admin') THEN
    RETURN 'El usuario ya es administrador';
  END IF;
  INSERT INTO user_roles (user_id, role) VALUES (target_user_id, 'admin');
  RETURN 'Usuario ' || user_email || ' ahora es administrador';
END;
$function$;

-- 7d. make_user_soporte - require existing admin
CREATE OR REPLACE FUNCTION public.make_user_soporte(user_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN 'No autorizado: se requiere rol de administrador';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  IF target_user_id IS NULL THEN RETURN 'Usuario no encontrado con email: ' || user_email; END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'soporte') THEN
    RETURN 'El usuario ya tiene rol de soporte';
  END IF;
  INSERT INTO user_roles (user_id, role) VALUES (target_user_id, 'soporte') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'Usuario ' || user_email || ' ahora tiene rol de soporte';
END;
$function$;

-- 7e. link_vendor_to_user - require admin
CREATE OR REPLACE FUNCTION public.link_vendor_to_user(vendor_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id UUID;
  vendor_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN 'No autorizado: se requiere rol de administrador';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = vendor_email;
  IF target_user_id IS NULL THEN RETURN 'Usuario no encontrado con email: ' || vendor_email; END IF;

  SELECT id INTO vendor_id FROM vendors WHERE user_id IS NULL LIMIT 1;
  IF vendor_id IS NULL THEN RETURN 'No hay vendedor sin usuario asignado'; END IF;

  UPDATE vendors SET user_id = target_user_id WHERE id = vendor_id;
  INSERT INTO user_roles (user_id, role) VALUES (target_user_id, 'vendor') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'Usuario vinculado exitosamente al vendedor';
END;
$function$;

-- 8. Fix other security definer views (vendor_details, public_vendors, etc.)
-- Recreate vendor_details with security_invoker
DROP VIEW IF EXISTS public.vendor_details;
CREATE VIEW public.vendor_details
WITH (security_invoker=on) AS
  SELECT
    v.id,
    v.name,
    v.category,
    v.address,
    v.phone,
    v.whatsapp_number,
    v.image,
    v.is_active,
    v.rating,
    v.average_rating,
    v.total_orders,
    v.total_reviews,
    v.days_open,
    v.opening_time,
    v.closing_time,
    v.available_products,
    v.created_at,
    v.updated_at,
    v.joined_at,
    v.user_id,
    v.address AS full_address,
    v.phone AS full_phone,
    v.whatsapp_number AS full_whatsapp
  FROM public.vendors v;

-- Recreate public_vendors with security_invoker
DROP VIEW IF EXISTS public.public_vendors;
CREATE VIEW public.public_vendors
WITH (security_invoker=on) AS
  SELECT
    v.id,
    v.name,
    v.category,
    v.image,
    v.is_active,
    v.rating,
    v.total_orders,
    v.days_open,
    v.opening_time,
    v.closing_time,
    v.joined_at,
    split_part(v.address, ',', 1) AS address_area,
    v.available_products,
    (EXISTS (SELECT 1 FROM products p WHERE p.vendor_id = v.id AND p.is_available = true)) AS has_products
  FROM public.vendors v;

-- Recreate vendor_orders_view with security_invoker
DROP VIEW IF EXISTS public.vendor_orders_view;
CREATE VIEW public.vendor_orders_view
WITH (security_invoker=on) AS
  SELECT
    o.id,
    o.vendor_id,
    o.items,
    o.total,
    o.status,
    o.notes,
    o.estimated_delivery,
    o.delivery_person_name,
    o.delivery_person_phone,
    o.coordinates,
    o.created_at,
    o.updated_at,
    get_simplified_address(o.address) AS address_simplified,
    get_masked_phone(o.customer_phone) AS customer_phone_masked,
    CASE WHEN o.customer_name IS NOT NULL THEN LEFT(o.customer_name, 1) || '***' ELSE NULL END AS customer_name_masked
  FROM public.orders o;

-- Also fix: order_status_history and messages INSERT to service_role
DROP POLICY IF EXISTS "Anyone can create status history" ON public.order_status_history;
CREATE POLICY "Service role can create status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Vendors should also be able to insert status history
CREATE POLICY "Vendors can create status history for their orders"
  ON public.order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o JOIN vendors v ON v.id = o.vendor_id
    WHERE o.id = order_status_history.order_id AND v.user_id = auth.uid()
  ));

-- Fix messages insert
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;
CREATE POLICY "Service role can send messages"
  ON public.messages FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Vendors can send messages for their orders"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o JOIN vendors v ON v.id = o.vendor_id
    WHERE o.id = messages.order_id AND v.user_id = auth.uid()
  ));

-- Fix vendor_chats insert
DROP POLICY IF EXISTS "System can create chats" ON public.vendor_chats;
CREATE POLICY "Service role can create chats"
  ON public.vendor_chats FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Vendors can create their own chats"
  ON public.vendor_chats FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM vendors WHERE vendors.id = vendor_chats.vendor_id AND vendors.user_id = auth.uid()
  ));

-- Fix chat_messages insert
DROP POLICY IF EXISTS "Anyone can create messages" ON public.chat_messages;
CREATE POLICY "Service role can create chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Vendors can create their chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM vendor_chats vc JOIN vendors v ON v.id = vc.vendor_id
    WHERE vc.id = chat_messages.chat_id AND v.user_id = auth.uid()
  ));
