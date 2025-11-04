-- Habilitar realtime para las tablas de chat
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_chats REPLICA IDENTITY FULL;

-- Agregar las tablas a la publicación de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_chats;