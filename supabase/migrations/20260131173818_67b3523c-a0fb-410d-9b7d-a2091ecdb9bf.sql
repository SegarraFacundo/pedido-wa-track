-- Fix: Allow vendors to upsert user_sessions when they're managing a chat
-- This is needed for the vendor panel to pause/unpause the bot

-- First, drop existing restrictive policy if any
DROP POLICY IF EXISTS "Vendors can upsert user sessions for their customers" ON user_sessions;

-- Create policy to allow vendors to update user_sessions for customers with active orders
CREATE POLICY "Vendors can upsert user sessions for their customers" ON user_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.customer_phone = user_sessions.phone
    AND v.user_id = auth.uid()
    AND o.status IN ('pending', 'confirmed', 'preparing', 'ready', 'on_the_way')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.customer_phone = user_sessions.phone
    AND v.user_id = auth.uid()
    AND o.status IN ('pending', 'confirmed', 'preparing', 'ready', 'on_the_way')
  )
);