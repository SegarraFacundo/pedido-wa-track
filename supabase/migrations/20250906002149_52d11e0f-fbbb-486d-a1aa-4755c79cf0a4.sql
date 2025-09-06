-- Create table for vendor offers/promotions
CREATE TABLE public.vendor_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discount_percentage INTEGER,
  original_price NUMERIC,
  offer_price NUMERIC,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for vendor reviews
CREATE TABLE public.vendor_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for direct vendor chats
CREATE TABLE public.vendor_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  vendor_agent_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.vendor_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'vendor', 'bot')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.vendor_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_offers
CREATE POLICY "Anyone can view active offers"
ON public.vendor_offers
FOR SELECT
USING (is_active = true);

CREATE POLICY "Vendors can manage their offers"
ON public.vendor_offers
FOR ALL
USING (EXISTS (
  SELECT 1 FROM vendors
  WHERE vendors.id = vendor_offers.vendor_id
  AND vendors.user_id = auth.uid()
));

-- RLS Policies for vendor_reviews
CREATE POLICY "Anyone can view reviews"
ON public.vendor_reviews
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create reviews"
ON public.vendor_reviews
FOR INSERT
WITH CHECK (true);

-- RLS Policies for vendor_chats
CREATE POLICY "Vendors can view their chats"
ON public.vendor_chats
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM vendors
  WHERE vendors.id = vendor_chats.vendor_id
  AND vendors.user_id = auth.uid()
));

CREATE POLICY "System can create chats"
ON public.vendor_chats
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Vendors can update their chats"
ON public.vendor_chats
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM vendors
  WHERE vendors.id = vendor_chats.vendor_id
  AND vendors.user_id = auth.uid()
));

-- RLS Policies for chat_messages
CREATE POLICY "Vendors can view their chat messages"
ON public.chat_messages
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM vendor_chats
  JOIN vendors ON vendors.id = vendor_chats.vendor_id
  WHERE vendor_chats.id = chat_messages.chat_id
  AND vendors.user_id = auth.uid()
));

CREATE POLICY "Anyone can create messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_vendor_offers_updated_at
BEFORE UPDATE ON public.vendor_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update vendors table to include average rating
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Create function to update vendor rating
CREATE OR REPLACE FUNCTION public.update_vendor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vendors
  SET 
    average_rating = (
      SELECT AVG(rating)
      FROM public.vendor_reviews
      WHERE vendor_id = NEW.vendor_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.vendor_reviews
      WHERE vendor_id = NEW.vendor_id
    )
  WHERE id = NEW.vendor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update vendor rating when review is added
CREATE TRIGGER update_vendor_rating_on_review
AFTER INSERT ON public.vendor_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_vendor_rating();