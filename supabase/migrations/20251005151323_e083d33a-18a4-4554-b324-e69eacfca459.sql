-- Actualizar función cleanup_old_sessions con search_path seguro
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE updated_at < NOW() - INTERVAL '7 days'
    AND in_vendor_chat = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;