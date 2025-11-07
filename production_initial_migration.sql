-- ============================================================================
-- PRODUCCIÓN: Migración Inicial Consolidada
-- ============================================================================
-- Este archivo contiene todo el schema necesario para iniciar el proyecto
-- de producción con una base de datos limpia.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONES Y TIPOS
-- ============================================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'vendor', 'customer', 'soporte');

-- ============================================================================
-- 2. TABLAS PRINCIPALES
-- ============================================================================

-- ===== PROFILES =====
-- Tabla de perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'customer',
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== USER_ROLES =====
-- Tabla separada para roles (seguridad)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- ===== VENDORS =====
-- Tabla de vendedores/comercios
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  address TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rating NUMERIC DEFAULT 0,
  average_rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image TEXT,
  user_id UUID REFERENCES auth.users(id),
  opening_time TIME DEFAULT '09:00:00',
  closing_time TIME DEFAULT '22:00:00',
  days_open TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  available_products JSONB DEFAULT '[]'::jsonb,
  latitude NUMERIC,
  longitude NUMERIC,
  delivery_radius_km NUMERIC DEFAULT 5.0,
  delivery_pricing_type TEXT DEFAULT 'per_km',
  delivery_price_per_km NUMERIC DEFAULT 0,
  delivery_fixed_price NUMERIC DEFAULT 0,
  delivery_additional_per_km NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'active',
  suspended_reason TEXT,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  next_payment_due TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VENDOR_HOURS =====
-- Horarios detallados de vendors (múltiples slots por día)
CREATE TABLE IF NOT EXISTS public.vendor_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  is_open_24_hours BOOLEAN DEFAULT false,
  slot_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PRODUCTS =====
-- Productos de cada vendor
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT[],
  image TEXT,
  is_available BOOLEAN DEFAULT true,
  stock_quantity INTEGER,
  stock_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VENDOR_OFFERS =====
-- Ofertas especiales de vendors
CREATE TABLE IF NOT EXISTS public.vendor_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discount_percentage INTEGER,
  original_price NUMERIC,
  offer_price NUMERIC,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ORDERS =====
-- Pedidos de clientes
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  items JSONB NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  address TEXT NOT NULL,
  address_is_manual BOOLEAN DEFAULT false,
  coordinates JSONB,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  delivery_person_name TEXT,
  delivery_person_phone TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_amount NUMERIC,
  payment_receipt_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar REPLICA IDENTITY para realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- ===== CUSTOMER_CONTACTS =====
-- Información sensible de clientes (separada por seguridad)
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ORDER_STATUS_HISTORY =====
-- Historial de cambios de estado de pedidos
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PAYMENT_METHODS =====
-- Métodos de pago disponibles
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ORDER_PAYMENTS =====
-- Pagos realizados por pedidos
CREATE TABLE IF NOT EXISTS public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  transaction_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== MESSAGES =====
-- Mensajes entre clientes y vendors sobre pedidos
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ===== VENDOR_NOTIFICATIONS =====
-- Notificaciones enviadas a vendors
CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.vendor_notifications REPLICA IDENTITY FULL;

-- ===== VENDOR_NOTIFICATION_SETTINGS =====
-- Configuración de notificaciones de cada vendor
CREATE TABLE IF NOT EXISTS public.vendor_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  notify_new_order BOOLEAN DEFAULT true,
  notify_order_cancelled BOOLEAN DEFAULT true,
  notify_customer_message BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== USER_SESSIONS =====
-- Sesiones de usuarios de WhatsApp bot
CREATE TABLE IF NOT EXISTS public.user_sessions (
  phone TEXT PRIMARY KEY,
  previous_state TEXT,
  last_bot_message TEXT,
  user_latitude NUMERIC,
  user_longitude NUMERIC,
  location_updated_at TIMESTAMP WITH TIME ZONE,
  in_vendor_chat BOOLEAN DEFAULT false,
  assigned_vendor_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CHAT_SESSIONS =====
-- Sesiones de chat del bot
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  phone TEXT PRIMARY KEY,
  vendor_preference UUID REFERENCES public.vendors(id),
  selected_product JSONB,
  selected_quantity INTEGER DEFAULT 1,
  pending_products JSONB DEFAULT '[]'::jsonb,
  pending_address TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== SAVED_ADDRESSES =====
-- Direcciones guardadas de usuarios
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  is_manual_entry BOOLEAN DEFAULT false,
  is_temporary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VENDOR_CHATS =====
-- Chats directos entre clientes y vendors
CREATE TABLE IF NOT EXISTS public.vendor_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  vendor_agent_name TEXT,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CHAT_MESSAGES =====
-- Mensajes de chats directos
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.vendor_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CUSTOMER_MESSAGES =====
-- Mensajes de clientes para vendors
CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== SUPPORT_TICKETS =====
-- Tickets de soporte
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== SUPPORT_MESSAGES =====
-- Mensajes de tickets de soporte
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== SUBSCRIPTION_PLANS =====
-- Planes de suscripción para vendors
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_fee NUMERIC NOT NULL,
  orders_included INTEGER NOT NULL,
  commission_after_limit NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== COMMISSION_SETTINGS =====
-- Configuración de comisiones por vendor
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL,
  commission_percentage NUMERIC,
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  subscription_monthly_fee NUMERIC DEFAULT 0,
  subscription_orders_included INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VENDOR_COMMISSIONS =====
-- Comisiones generadas por vendor
CREATE TABLE IF NOT EXISTS public.vendor_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL,
  commission_type TEXT NOT NULL,
  commission_percentage NUMERIC,
  order_total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VENDOR_REVIEWS =====
-- Reseñas de vendors
CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER,
  product_rating INTEGER,
  service_rating INTEGER,
  delivery_rating INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON public.vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_payment_status ON public.vendors(payment_status);
CREATE INDEX IF NOT EXISTS idx_vendors_location ON public.vendors(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING GIN(category);

CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_updated_at ON public.user_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_vendor_hours_vendor_id ON public.vendor_hours(vendor_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_phone ON public.support_tickets(customer_phone);

-- ============================================================================
-- 4. FUNCIONES AUXILIARES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
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

CREATE OR REPLACE FUNCTION public.get_masked_phone(phone TEXT)
RETURNS TEXT 
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF phone IS NULL OR length(phone) < 4 THEN
    RETURN '****';
  END IF;
  RETURN '****' || substring(phone from length(phone) - 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_simplified_address(full_address TEXT)
RETURNS TEXT 
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN split_part(full_address, ',', 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_customer_details(order_id_param UUID)
RETURNS TABLE(customer_name TEXT, customer_phone TEXT, customer_address TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(cc.customer_name, o.customer_name),
    COALESCE(cc.customer_phone, o.customer_phone),
    COALESCE(cc.customer_address, o.address)
  FROM public.orders o
  LEFT JOIN public.customer_contacts cc ON cc.order_id = o.id
  WHERE o.id = order_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  earth_radius NUMERIC := 6371;
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat/2) * SIN(dlat/2) + 
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
       SIN(dlon/2) * SIN(dlon/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN earth_radius * c;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendors_in_range(user_lat NUMERIC, user_lon NUMERIC)
RETURNS TABLE(
  vendor_id UUID, 
  vendor_name TEXT, 
  distance_km NUMERIC, 
  delivery_radius_km NUMERIC, 
  is_open BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  current_day_name TEXT;
  current_time_arg TIME;
BEGIN
  SELECT LOWER(TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Day'))
  INTO current_day_name;
  current_day_name := TRIM(current_day_name);
  
  current_time_arg := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;

  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    calculate_distance(user_lat, user_lon, v.latitude, v.longitude) as distance_km,
    v.delivery_radius_km,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM vendor_hours vh 
        WHERE vh.vendor_id = v.id 
        AND LOWER(vh.day_of_week) = current_day_name
      ) THEN (
        SELECT COALESCE(
          bool_or(
            CASE
              WHEN vh.is_closed THEN false
              WHEN vh.is_open_24_hours THEN true
              ELSE current_time_arg BETWEEN vh.opening_time AND vh.closing_time
            END
          ),
          false
        )
        FROM vendor_hours vh
        WHERE vh.vendor_id = v.id 
        AND LOWER(vh.day_of_week) = current_day_name
      )
      ELSE (
        CASE 
          WHEN current_day_name = ANY(v.days_open)
            AND current_time_arg BETWEEN v.opening_time AND v.closing_time
          THEN true
          ELSE false
        END
      )
    END as is_open
  FROM vendors v
  WHERE 
    v.is_active = true
    AND v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND calculate_distance(user_lat, user_lon, v.latitude, v.longitude) <= COALESCE(v.delivery_radius_km, 5.0)
  ORDER BY distance_km ASC, is_open DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_products_by_category(category_filter TEXT DEFAULT NULL)
RETURNS TABLE(
  vendor_id UUID,
  vendor_name TEXT,
  product_id UUID,
  product_name TEXT,
  product_description TEXT,
  product_price NUMERIC,
  product_category TEXT,
  is_available BOOLEAN,
  vendor_rating NUMERIC,
  vendor_is_open BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    p.price as product_price,
    p.category::TEXT as product_category,
    p.is_available,
    v.average_rating as vendor_rating,
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::TEXT = ANY(v.days_open)
        AND (CURRENT_TIME AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN v.opening_time AND v.closing_time
      THEN true
      ELSE false
    END as vendor_is_open
  FROM vendors v
  JOIN products p ON p.vendor_id = v.id
  WHERE 
    v.is_active = true
    AND p.is_available = true
    AND (category_filter IS NULL OR LOWER(p.category::TEXT) LIKE LOWER('%' || category_filter || '%'))
  ORDER BY vendor_is_open DESC, v.average_rating DESC, p.price ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_order_status(
  p_order_id UUID, 
  p_new_status TEXT, 
  p_changed_by TEXT, 
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_vendor_id UUID;
BEGIN
  SELECT status, vendor_id INTO v_current_status, v_vendor_id
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF p_changed_by = 'customer' AND p_new_status = 'cancelled' THEN
    IF v_current_status NOT IN ('pending', 'confirmed') THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  UPDATE orders
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  INSERT INTO order_status_history (order_id, status, changed_by, reason)
  VALUES (p_order_id, p_new_status, p_changed_by, p_reason);
  
  RETURN TRUE;
END;
$$;

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
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    SELECT * INTO v_commission_setting
    FROM commission_settings
    WHERE vendor_id = NEW.vendor_id AND is_active = true;
    
    IF FOUND THEN
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
        SELECT COUNT(*) INTO v_orders_this_month
        FROM orders
        WHERE vendor_id = NEW.vendor_id
        AND status = 'delivered'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
        
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

CREATE OR REPLACE FUNCTION public.update_vendor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE updated_at < NOW() - INTERVAL '7 days'
    AND in_vendor_chat = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_support_ticket_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RETURN 'Usuario no encontrado con email: ' || user_email;
  END IF;
  
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'admin') THEN
    RETURN 'El usuario ya es administrador';
  END IF;
  
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'admin');
  
  RETURN 'Usuario ' || user_email || ' ahora es administrador';
END;
$$;

CREATE OR REPLACE FUNCTION public.make_user_soporte(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RETURN 'Usuario no encontrado con email: ' || user_email;
  END IF;
  
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role = 'soporte') THEN
    RETURN 'El usuario ya tiene rol de soporte';
  END IF;
  
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'soporte')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN 'Usuario ' || user_email || ' ahora tiene rol de soporte';
END;
$$;

CREATE OR REPLACE FUNCTION public.link_vendor_to_user(vendor_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  vendor_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = vendor_email;
  
  IF target_user_id IS NULL THEN
    RETURN 'Usuario no encontrado con email: ' || vendor_email;
  END IF;
  
  SELECT id INTO vendor_id
  FROM vendors
  WHERE phone = '+595996789012' AND user_id IS NULL;
  
  IF vendor_id IS NULL THEN
    RETURN 'Vendedor no encontrado o ya tiene usuario asignado';
  END IF;
  
  UPDATE vendors
  SET user_id = target_user_id
  WHERE id = vendor_id;
  
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, 'vendor')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN 'Usuario vinculado exitosamente al vendedor';
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_hours_updated_at
  BEFORE UPDATE ON public.vendor_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_offers_updated_at
  BEFORE UPDATE ON public.vendor_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_notification_settings_updated_at
  BEFORE UPDATE ON public.vendor_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_settings_updated_at
  BEFORE UPDATE ON public.commission_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_support_ticket_timestamp();

CREATE TRIGGER on_review_insert
  AFTER INSERT ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_rating();

CREATE TRIGGER calculate_commission_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.calculate_commission_on_delivery();

-- ============================================================================
-- 6. VISTAS
-- ============================================================================

CREATE OR REPLACE VIEW public.vendor_orders_view AS
SELECT 
  o.id,
  o.vendor_id,
  CASE 
    WHEN cc.customer_name IS NOT NULL THEN substring(cc.customer_name from 1 for 1) || '***'
    ELSE substring(o.customer_name from 1 for 1) || '***'
  END as customer_name_masked,
  CASE
    WHEN cc.customer_phone IS NOT NULL THEN get_masked_phone(cc.customer_phone)
    ELSE get_masked_phone(o.customer_phone)
  END as customer_phone_masked,
  CASE
    WHEN cc.customer_address IS NOT NULL THEN get_simplified_address(cc.customer_address)
    ELSE get_simplified_address(o.address)
  END as address_simplified,
  o.items,
  o.total,
  o.status,
  o.coordinates,
  o.estimated_delivery,
  o.notes,
  o.delivery_person_name,
  o.delivery_person_phone,
  o.created_at,
  o.updated_at
FROM public.orders o
LEFT JOIN public.customer_contacts cc ON cc.order_id = o.id;

CREATE OR REPLACE VIEW public.public_vendors AS
SELECT 
  v.id,
  v.name,
  v.category,
  v.image,
  v.rating,
  v.average_rating,
  v.total_reviews,
  v.total_orders,
  v.is_active,
  v.joined_at,
  v.opening_time,
  v.closing_time,
  v.days_open,
  v.available_products,
  get_simplified_address(v.address) as address_area,
  CASE 
    WHEN EXISTS (SELECT 1 FROM products WHERE vendor_id = v.id AND is_available = true)
    THEN true 
    ELSE false 
  END as has_products
FROM public.vendors v
WHERE v.is_active = true AND v.payment_status = 'active';

CREATE OR REPLACE VIEW public.vendor_details AS
SELECT 
  v.*,
  v.phone as full_phone,
  v.whatsapp_number as full_whatsapp,
  v.address as full_address
FROM public.vendors v;

CREATE OR REPLACE VIEW public.vendor_reviews_public AS
SELECT 
  id,
  vendor_id,
  rating,
  comment,
  created_at,
  substring(customer_name from 1 for 1) || '***' as customer_name,
  get_masked_phone(customer_phone) as customer_phone
FROM public.vendor_reviews;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Block unauthenticated access to profiles"
  ON public.profiles FOR SELECT
  USING (false);

-- USER_ROLES POLICIES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- VENDORS POLICIES
CREATE POLICY "Vendors can view own data"
  ON public.vendors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Vendors can update own data"
  ON public.vendors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage vendors"
  ON public.vendors FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can read active vendors"
  ON public.vendors FOR SELECT
  USING (
    (auth.jwt() IS NULL OR (auth.jwt()->>'role')::text = 'service_role')
    AND payment_status = 'active'
  );

-- VENDOR_HOURS POLICIES
CREATE POLICY "Anyone can view vendor hours"
  ON public.vendor_hours FOR SELECT
  USING (true);

CREATE POLICY "Vendors can manage their hours"
  ON public.vendor_hours FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_hours.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

-- PRODUCTS POLICIES
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Vendors can manage their products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = products.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

-- VENDOR_OFFERS POLICIES
CREATE POLICY "Anyone can view active offers"
  ON public.vendor_offers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Vendors can manage their offers"
  ON public.vendor_offers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_offers.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

-- ORDERS POLICIES
CREATE POLICY "Vendors can view their orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = orders.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = orders.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- CUSTOMER_CONTACTS POLICIES
CREATE POLICY "Admins can view customer contacts"
  ON public.customer_contacts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create customer contacts"
  ON public.customer_contacts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update customer contacts"
  ON public.customer_contacts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- ORDER_STATUS_HISTORY POLICIES
CREATE POLICY "Vendors can view status history for their orders"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE o.id = order_status_history.order_id 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (true);

-- PAYMENT_METHODS POLICIES
CREATE POLICY "Anyone can view payment methods"
  ON public.payment_methods FOR SELECT
  USING (is_active = true);

-- ORDER_PAYMENTS POLICIES
CREATE POLICY "Vendors can view payments for their orders"
  ON public.order_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE o.id = order_payments.order_id 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage payments"
  ON public.order_payments FOR ALL
  USING (true);

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages for their orders"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN vendors ON vendors.id = orders.vendor_id
      WHERE orders.id = messages.order_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- VENDOR_NOTIFICATIONS POLICIES
CREATE POLICY "Vendors can view their notifications"
  ON public.vendor_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_notifications.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create notifications"
  ON public.vendor_notifications FOR INSERT
  WITH CHECK (true);

-- VENDOR_NOTIFICATION_SETTINGS POLICIES
CREATE POLICY "Vendors can view their notification settings"
  ON public.vendor_notification_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_notification_settings.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their notification settings"
  ON public.vendor_notification_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_notification_settings.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert their notification settings"
  ON public.vendor_notification_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_notification_settings.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

-- USER_SESSIONS POLICIES
CREATE POLICY "System can manage user sessions"
  ON public.user_sessions FOR ALL
  USING ((auth.jwt()->>'role')::text = 'service_role');

-- CHAT_SESSIONS POLICIES
CREATE POLICY "Only system can read chat sessions"
  ON public.chat_sessions FOR SELECT
  USING ((auth.jwt()->>'role')::text = 'service_role');

CREATE POLICY "Only system can create chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK ((auth.jwt()->>'role')::text = 'service_role');

CREATE POLICY "Only system can update chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING ((auth.jwt()->>'role')::text = 'service_role');

CREATE POLICY "Admins can view chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- SAVED_ADDRESSES POLICIES
CREATE POLICY "System can manage saved addresses"
  ON public.saved_addresses FOR ALL
  USING ((auth.jwt()->>'role')::text = 'service_role');

-- VENDOR_CHATS POLICIES
CREATE POLICY "Vendors can view their chats"
  ON public.vendor_chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_chats.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their chats"
  ON public.vendor_chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_chats.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create chats"
  ON public.vendor_chats FOR INSERT
  WITH CHECK (true);

-- CHAT_MESSAGES POLICIES
CREATE POLICY "Vendors can view their chat messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendor_chats
      JOIN vendors ON vendors.id = vendor_chats.vendor_id
      WHERE vendor_chats.id = chat_messages.chat_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (true);

-- CUSTOMER_MESSAGES POLICIES
CREATE POLICY "Vendors can view their assigned messages"
  ON public.customer_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN vendors v ON (v.phone = us.assigned_vendor_phone OR v.whatsapp_number = us.assigned_vendor_phone)
      WHERE us.phone = customer_messages.customer_phone 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their assigned messages"
  ON public.customer_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN vendors v ON (v.phone = us.assigned_vendor_phone OR v.whatsapp_number = us.assigned_vendor_phone)
      WHERE us.phone = customer_messages.customer_phone 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage customer messages"
  ON public.customer_messages FOR ALL
  USING ((auth.jwt()->>'role')::text = 'service_role');

-- SUPPORT_TICKETS POLICIES
CREATE POLICY "Vendors can view their own tickets"
  ON public.support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.user_id = auth.uid() 
      AND vendors.phone = support_tickets.customer_phone
    )
  );

CREATE POLICY "Vendors can create support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.user_id = auth.uid() 
      AND vendors.phone = support_tickets.customer_phone
    )
  );

CREATE POLICY "Admin puede ver todos los tickets"
  ON public.support_tickets FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin puede actualizar tickets"
  ON public.support_tickets FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin puede crear tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema puede actualizar tickets"
  ON public.support_tickets FOR UPDATE
  USING ((auth.jwt()->>'role')::text = 'service_role');

-- SUPPORT_MESSAGES POLICIES
CREATE POLICY "Vendors can view their ticket messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      JOIN vendors v ON v.phone = st.customer_phone
      WHERE st.id = support_messages.ticket_id 
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can create messages on their tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      JOIN vendors v ON v.phone = st.customer_phone
      WHERE st.id = support_messages.ticket_id 
      AND v.user_id = auth.uid() 
      AND support_messages.sender_type = 'customer'
    )
  );

CREATE POLICY "Admin puede ver mensajes de tickets"
  ON public.support_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin puede crear mensajes"
  ON public.support_messages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND sender_type = 'support');

-- SUBSCRIPTION_PLANS POLICIES
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- COMMISSION_SETTINGS POLICIES
CREATE POLICY "Vendors can view their commission settings"
  ON public.commission_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = commission_settings.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage commission settings"
  ON public.commission_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- VENDOR_COMMISSIONS POLICIES
CREATE POLICY "Vendors can view their commissions"
  ON public.vendor_commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_commissions.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all commissions"
  ON public.vendor_commissions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- VENDOR_REVIEWS POLICIES
CREATE POLICY "Anyone can create reviews"
  ON public.vendor_reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Vendors can view full details of their reviews"
  ON public.vendor_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = vendor_reviews.vendor_id 
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all reviews"
  ON public.vendor_reviews FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 8. PERMISOS EN VISTAS
-- ============================================================================

GRANT SELECT ON public.vendor_orders_view TO authenticated;
GRANT SELECT ON public.public_vendors TO authenticated, anon;
GRANT SELECT ON public.vendor_details TO authenticated;
GRANT SELECT ON public.vendor_reviews_public TO authenticated, anon;

-- ============================================================================
-- FIN DE MIGRACIÓN CONSOLIDADA
-- ============================================================================
