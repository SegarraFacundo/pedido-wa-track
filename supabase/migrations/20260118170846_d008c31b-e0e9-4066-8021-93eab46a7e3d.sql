-- Create admin_emergency_contacts table for emergency notification settings
CREATE TABLE public.admin_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notify_email BOOLEAN DEFAULT true,
  notify_whatsapp BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Only admins can view emergency contacts
CREATE POLICY "Admins can view emergency contacts"
ON public.admin_emergency_contacts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert their own contact
CREATE POLICY "Admins can insert their own emergency contact"
ON public.admin_emergency_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND auth.uid() = user_id
);

-- Only admins can update their own contact
CREATE POLICY "Admins can update their own emergency contact"
ON public.admin_emergency_contacts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Only admins can delete their own contact
CREATE POLICY "Admins can delete their own emergency contact"
ON public.admin_emergency_contacts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_admin_emergency_contacts_updated_at
BEFORE UPDATE ON public.admin_emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate with existing admins (getting their emails from auth.users)
INSERT INTO public.admin_emergency_contacts (user_id, email)
SELECT u.id, u.email
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;