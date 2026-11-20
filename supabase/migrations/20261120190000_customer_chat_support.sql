-- ============================================================
-- Chat cliente-vendedor y soporte desde la PWA.
-- Atamos los hilos a auth.users (user_id) y damos lectura al cliente dueño.
-- La escritura la hacen edge functions con service role (enviar-mensaje-vendedor,
-- contactar-soporte), así que no se agregan políticas de INSERT para el cliente.
-- ============================================================

-- ---------- Chat con el vendedor ----------
ALTER TABLE public.vendor_chats
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_chats_user_id ON public.vendor_chats(user_id);

DROP POLICY IF EXISTS "Customers can view their own chats" ON public.vendor_chats;
CREATE POLICY "Customers can view their own chats"
  ON public.vendor_chats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can view their chat messages" ON public.chat_messages;
CREATE POLICY "Customers can view their chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendor_chats c
    WHERE c.id = chat_messages.chat_id AND c.user_id = auth.uid()
  ));

-- Realtime para los mensajes nuevos del chat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- ---------- Soporte ----------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.support_tickets;
CREATE POLICY "Customers can view their own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
