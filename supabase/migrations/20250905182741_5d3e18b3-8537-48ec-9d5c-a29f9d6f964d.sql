-- CRITICAL SECURITY FIX: Remove public access to chat_sessions table
-- This table contains sensitive customer data (phone numbers, addresses)

-- First, drop the dangerous policy that allows anyone to access everything
DROP POLICY IF EXISTS "Anyone can manage their chat session" ON public.chat_sessions;

-- Create a secure policy that only allows the system (service role) to manage chat sessions
-- The WhatsApp webhook uses service role key which bypasses RLS, so this will still work
CREATE POLICY "Only system can create chat sessions" 
ON public.chat_sessions 
FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Only system can update chat sessions" 
ON public.chat_sessions 
FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Only system can read chat sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow admins to view chat sessions for support purposes
CREATE POLICY "Admins can view chat sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Add a comment explaining the security model
COMMENT ON TABLE public.chat_sessions IS 'Contains sensitive customer data. Only accessible by system service role (WhatsApp webhook) and admin users. Customer phone numbers and addresses are protected.';