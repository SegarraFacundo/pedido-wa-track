-- ============================================================
-- Web push del cliente: guarda las suscripciones del navegador (PushSubscription).
-- El cliente inserta/borra la suya (RLS de dueño). El emisor (edge function
-- send-push) las lee con service role.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Customers manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
