-- Add business hours and WhatsApp number to vendors
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '22:00:00',
ADD COLUMN IF NOT EXISTS available_products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS days_open TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

-- Create vendor notifications table
CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for vendor_notifications
ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for vendor_notifications
CREATE POLICY "Vendors can view their notifications" 
ON public.vendor_notifications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM vendors 
    WHERE vendors.id = vendor_notifications.vendor_id 
    AND vendors.user_id = auth.uid()
  )
);

CREATE POLICY "System can create notifications" 
ON public.vendor_notifications 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at on vendor_notifications
CREATE TRIGGER update_vendor_notifications_updated_at
BEFORE UPDATE ON public.vendor_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();