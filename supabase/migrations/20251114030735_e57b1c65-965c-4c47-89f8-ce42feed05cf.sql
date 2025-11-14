-- Create commission_invoices table
CREATE TABLE IF NOT EXISTS public.commission_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create commission_invoice_items table (links invoices to commissions)
CREATE TABLE IF NOT EXISTS public.commission_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.commission_invoices(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES public.vendor_commissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(invoice_id, commission_id)
);

-- Update vendor_commissions status to include new states
ALTER TABLE public.vendor_commissions 
  DROP CONSTRAINT IF EXISTS vendor_commissions_status_check;

ALTER TABLE public.vendor_commissions 
  ADD CONSTRAINT vendor_commissions_status_check 
  CHECK (status IN ('pending', 'invoiced', 'paid', 'cancelled'));

-- Add trigger for updated_at on commission_invoices
CREATE TRIGGER update_commission_invoices_updated_at
  BEFORE UPDATE ON public.commission_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_invoices_vendor_id ON public.commission_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commission_invoices_status ON public.commission_invoices(status);
CREATE INDEX IF NOT EXISTS idx_commission_invoices_period ON public.commission_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_invoice_items_invoice_id ON public.commission_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_invoice_items_commission_id ON public.commission_invoice_items(commission_id);

-- Enable RLS
ALTER TABLE public.commission_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_invoices
CREATE POLICY "Admins can manage all invoices"
  ON public.commission_invoices
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view their invoices"
  ON public.commission_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors
      WHERE vendors.id = commission_invoices.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- RLS Policies for commission_invoice_items
CREATE POLICY "Admins can manage all invoice items"
  ON public.commission_invoice_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view their invoice items"
  ON public.commission_invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.commission_invoices ci
      JOIN public.vendors v ON v.id = ci.vendor_id
      WHERE ci.id = commission_invoice_items.invoice_id
      AND v.user_id = auth.uid()
    )
  );

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  next_num INTEGER;
  invoice_num TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'FC-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM commission_invoices
  WHERE invoice_number LIKE 'FC-' || year_part || '-%';
  
  invoice_num := 'FC-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$;

COMMENT ON TABLE public.commission_invoices IS 'Stores invoices for vendor commissions';
COMMENT ON TABLE public.commission_invoice_items IS 'Links invoices to individual commission records';