-- Limpiar el historial de conversación del usuario para forzar reconsulta
UPDATE user_sessions
SET last_bot_message = NULL,
    previous_state = NULL,
    updated_at = NOW()
WHERE phone = '5493464448309';