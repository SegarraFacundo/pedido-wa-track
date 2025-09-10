-- Add selection columns to chat_sessions to support quick ordering flow
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS selected_product jsonb,
ADD COLUMN IF NOT EXISTS selected_quantity integer DEFAULT 1;