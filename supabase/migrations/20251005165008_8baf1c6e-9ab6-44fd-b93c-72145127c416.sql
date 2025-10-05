-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'vendor', 'customer');

-- Create user_roles table (CRITICAL: roles must be in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create commission_settings table
CREATE TABLE public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL UNIQUE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'subscription')),
  commission_percentage NUMERIC CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  subscription_plan_id UUID,
  subscription_orders_included INTEGER DEFAULT 0,
  subscription_monthly_fee NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_fee NUMERIC NOT NULL,
  orders_included INTEGER NOT NULL,
  commission_after_limit NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create vendor_commissions table to track commissions
CREATE TABLE public.vendor_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  commission_amount NUMERIC NOT NULL,
  commission_type TEXT NOT NULL,
  commission_percentage NUMERIC,
  order_total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.vendor_commissions ENABLE ROW LEVEL SECURITY;

-- Add payment and suspension fields to vendors
ALTER TABLE public.vendors
ADD COLUMN payment_status TEXT DEFAULT 'active' CHECK (payment_status IN ('active', 'suspended', 'pending')),
ADD COLUMN suspended_reason TEXT,
ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN next_payment_due TIMESTAMP WITH TIME ZONE;

-- RLS policies for commission_settings
CREATE POLICY "Admins can manage commission settings"
ON public.commission_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view their commission settings"
ON public.commission_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors
    WHERE vendors.id = commission_settings.vendor_id
    AND vendors.user_id = auth.uid()
  )
);

-- RLS policies for subscription_plans
CREATE POLICY "Admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS policies for vendor_commissions
CREATE POLICY "Admins can manage all commissions"
ON public.vendor_commissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view their commissions"
ON public.vendor_commissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors
    WHERE vendors.id = vendor_commissions.vendor_id
    AND vendors.user_id = auth.uid()
  )
);

-- Function to calculate and record commission when order is delivered
CREATE OR REPLACE FUNCTION public.calculate_commission_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_setting RECORD;
  v_commission_amount NUMERIC;
  v_orders_this_month INTEGER;
BEGIN
  -- Only calculate commission when order status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- Get commission settings for this vendor
    SELECT * INTO v_commission_setting
    FROM commission_settings
    WHERE vendor_id = NEW.vendor_id AND is_active = true;
    
    IF FOUND THEN
      -- Calculate based on commission type
      IF v_commission_setting.commission_type = 'percentage' THEN
        v_commission_amount := NEW.total * (v_commission_setting.commission_percentage / 100);
        
        INSERT INTO vendor_commissions (
          vendor_id, order_id, commission_amount, commission_type,
          commission_percentage, order_total, status
        ) VALUES (
          NEW.vendor_id, NEW.id, v_commission_amount, 'percentage',
          v_commission_setting.commission_percentage, NEW.total, 'pending'
        );
        
      ELSIF v_commission_setting.commission_type = 'subscription' THEN
        -- Count orders this month for this vendor
        SELECT COUNT(*) INTO v_orders_this_month
        FROM orders
        WHERE vendor_id = NEW.vendor_id
        AND status = 'delivered'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
        
        -- If exceeded included orders, charge commission
        IF v_orders_this_month > v_commission_setting.subscription_orders_included THEN
          v_commission_amount := NEW.total * (v_commission_setting.commission_percentage / 100);
          
          INSERT INTO vendor_commissions (
            vendor_id, order_id, commission_amount, commission_type,
            commission_percentage, order_total, status
          ) VALUES (
            NEW.vendor_id, NEW.id, v_commission_amount, 'subscription_overage',
            v_commission_setting.commission_percentage, NEW.total, 'pending'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to calculate commission on order delivery
CREATE TRIGGER calculate_commission_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_commission_on_delivery();

-- Update vendors RLS to respect payment_status
DROP POLICY IF EXISTS "System can read vendors" ON public.vendors;
CREATE POLICY "System can read active vendors"
ON public.vendors
FOR SELECT
USING (
  (auth.jwt() IS NULL OR (auth.jwt() ->> 'role') = 'service_role')
  AND payment_status = 'active'
);