CREATE POLICY "Admins can delete bot logs"
ON public.bot_interaction_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));