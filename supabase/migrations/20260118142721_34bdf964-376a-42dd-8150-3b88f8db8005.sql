-- Create platform_settings table for global system configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  bot_enabled BOOLEAN NOT NULL DEFAULT true,
  emergency_mode BOOLEAN NOT NULL DEFAULT false,
  emergency_message TEXT DEFAULT '⚠️ Estamos experimentando dificultades técnicas. Tu mensaje fue enviado directamente al negocio y te responderán pronto. Disculpa las molestias.',
  fallback_mode TEXT NOT NULL DEFAULT 'vendor_direct' CHECK (fallback_mode IN ('vendor_direct', 'support_queue', 'offline')),
  last_error TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  auto_emergency_threshold INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default global settings if not exists
INSERT INTO public.platform_settings (id) 
VALUES ('global') 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view platform settings
CREATE POLICY "Admins can view platform settings"
ON public.platform_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Only admins can update platform settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_platform_settings_timestamp
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_platform_settings_updated_at();

-- Create error_logs table to track bot errors for debugging
CREATE TABLE IF NOT EXISTS public.bot_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  customer_phone TEXT,
  vendor_id UUID REFERENCES public.vendors(id),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for error logs
ALTER TABLE public.bot_error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view error logs
CREATE POLICY "Admins can view error logs"
ON public.bot_error_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Edge functions can insert error logs (using service role)
CREATE POLICY "Service role can insert error logs"
ON public.bot_error_logs
FOR INSERT
WITH CHECK (true);

-- Policy: Admins can update error logs (mark as resolved)
CREATE POLICY "Admins can update error logs"
ON public.bot_error_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);