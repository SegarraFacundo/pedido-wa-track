
-- Fix remaining security definer views
DROP VIEW IF EXISTS public.vendor_change_summary;
CREATE VIEW public.vendor_change_summary
WITH (security_invoker=on) AS
  SELECT
    vca.current_vendor_id AS vendor_id,
    v.name AS vendor_name,
    v.category,
    COUNT(DISTINCT CASE WHEN vca.action = 'confirmed_change' THEN vca.user_phone_hash END) AS lost_customers,
    COUNT(DISTINCT CASE WHEN vca.action = 'confirmed_change' THEN NULL END) AS acquired_customers,
    COUNT(DISTINCT CASE WHEN vca.action = 'cancelled_change' THEN vca.user_phone_hash END) AS retained_customers,
    COUNT(DISTINCT CASE WHEN vca.action = 'confirmed_change' THEN vca.user_phone_hash END) * -1 +
    COUNT(DISTINCT CASE WHEN vca.action = 'cancelled_change' THEN vca.user_phone_hash END) AS net_customer_change
  FROM public.vendor_change_analytics vca
  JOIN public.vendors v ON v.id = vca.current_vendor_id
  GROUP BY vca.current_vendor_id, v.name, v.category;

DROP VIEW IF EXISTS public.vendor_change_metrics;
CREATE VIEW public.vendor_change_metrics
WITH (security_invoker=on) AS
  SELECT
    date_trunc('day', vca.created_at) AS date,
    vca.action,
    COUNT(*) AS total_events,
    COUNT(DISTINCT vca.user_phone_hash) AS unique_users,
    AVG(vca.cart_items_count) AS avg_cart_items,
    AVG(vca.cart_total_amount) AS avg_cart_value,
    AVG(vca.session_duration_seconds) AS avg_decision_time_seconds
  FROM public.vendor_change_analytics vca
  GROUP BY date_trunc('day', vca.created_at), vca.action;
