
-- 1. Fix bot_error_logs: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service role can insert error logs" ON public.bot_error_logs;
CREATE POLICY "Service role can insert error logs"
  ON public.bot_error_logs FOR INSERT
  TO public
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- 2. Fix vendor_notifications: restrict INSERT to service_role only
DROP POLICY IF EXISTS "System can create notifications" ON public.vendor_notifications;
CREATE POLICY "Service role can create notifications"
  ON public.vendor_notifications FOR INSERT
  TO public
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- 3. Recreate vendor_details view with security_invoker to respect RLS on vendors table
DROP VIEW IF EXISTS public.vendor_details;
CREATE VIEW public.vendor_details WITH (security_invoker = on) AS
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
  v.opening_time,
  v.closing_time,
  v.available_products,
  v.created_at,
  v.updated_at,
  v.joined_at,
  v.user_id,
  v.days_open,
  v.address AS full_address,
  v.phone AS full_phone,
  v.whatsapp_number AS full_whatsapp
FROM vendors v;
