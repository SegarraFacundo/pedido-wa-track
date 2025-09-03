-- Chat sessions to hold partial info between WhatsApp messages
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  phone TEXT PRIMARY KEY,
  pending_products JSONB DEFAULT '[]'::jsonb,
  pending_address TEXT,
  vendor_preference UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
-- No policies so only service role (edge functions) can access effectively

COMMENT ON TABLE public.chat_sessions IS 'Holds temporary chat state (products/address) per phone to avoid conversational loops.';