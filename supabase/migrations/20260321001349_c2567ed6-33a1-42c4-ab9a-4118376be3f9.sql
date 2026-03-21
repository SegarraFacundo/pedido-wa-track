CREATE TABLE public.bot_interaction_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  message_preview text,
  intent_detected text,
  state_before text,
  state_after text,
  action_taken text,
  response_preview text,
  confidence numeric,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage bot logs"
  ON public.bot_interaction_logs FOR ALL
  TO public
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Admins can view bot logs"
  ON public.bot_interaction_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bot_interaction_logs_phone ON public.bot_interaction_logs (phone);
CREATE INDEX idx_bot_interaction_logs_created_at ON public.bot_interaction_logs (created_at DESC);
CREATE INDEX idx_bot_interaction_logs_intent ON public.bot_interaction_logs (intent_detected);