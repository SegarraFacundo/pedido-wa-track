-- ============================================================
-- Asignación automática de repartos por cercanía (Fase 2).
-- Al crearse un reparto 'available', o cuando un repartidor libre se pone
-- online / actualiza su ubicación, se asigna al repartidor libre + online +
-- ubicable más cercano al PUNTO DE RETIRO (el vendor). Si no hay ninguno
-- elegible, el reparto queda en el pool (fallback: "Tomar" manual).
-- ============================================================

-- Marca de tiempo de la última ubicación conocida (frescura para auto-asignar).
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Setea location_updated_at solo cuando cambia la ubicación.
CREATE OR REPLACE FUNCTION public.touch_courier_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_lat IS DISTINCT FROM OLD.current_lat
     OR NEW.current_lng IS DISTINCT FROM OLD.current_lng THEN
    NEW.location_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_courier_location ON public.couriers;
CREATE TRIGGER trg_touch_courier_location
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_courier_location();

-- Distancia haversine en km (para ordenar por cercanía).
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * acos(
    least(1, greatest(-1,
      sin(radians(lat1)) * sin(radians(lat2)) +
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2 - lng1))
    ))
  );
$$;

-- Asigna un reparto disponible al repartidor libre más cercano al retiro.
CREATE OR REPLACE FUNCTION public.auto_assign_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_courier uuid;
  v_fee numeric;
BEGIN
  -- Punto de retiro = ubicación del vendor del pedido.
  SELECT ven.latitude, ven.longitude
    INTO v_lat, v_lng
  FROM public.deliveries d
  JOIN public.orders o    ON o.id = d.order_id
  JOIN public.vendors ven ON ven.id = o.vendor_id
  WHERE d.id = p_delivery_id
    AND d.status = 'available'
    AND d.courier_id IS NULL;

  IF NOT FOUND OR v_lat IS NULL OR v_lng IS NULL THEN
    RETURN; -- sin coords de retiro → queda en el pool
  END IF;

  SELECT c.id, c.payout_fee
    INTO v_courier, v_fee
  FROM public.couriers c
  WHERE c.is_active
    AND c.is_online
    AND c.current_lat IS NOT NULL
    AND c.current_lng IS NOT NULL
    AND c.location_updated_at >= now() - interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.deliveries d2
      WHERE d2.courier_id = c.id
        AND d2.status IN ('assigned', 'picked_up', 'delivering')
    )
  ORDER BY public.haversine_km(c.current_lat, c.current_lng, v_lat, v_lng) ASC
  LIMIT 1;

  IF v_courier IS NULL THEN
    RETURN; -- nadie libre y cerca → pool
  END IF;

  UPDATE public.deliveries
     SET courier_id  = v_courier,
         status      = 'assigned',
         assigned_at = now(),
         fee         = COALESCE(v_fee, 0)
   WHERE id = p_delivery_id
     AND status = 'available'
     AND courier_id IS NULL; -- guard anti-carrera
END;
$$;

-- Dado un repartidor libre/ubicable, le da el reparto disponible más cercano
-- a su posición (arranque en frío y cuando termina uno).
CREATE OR REPLACE FUNCTION public.try_assign_pending_to_courier(p_courier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_lat double precision;
  c_lng double precision;
  c_fee numeric;
  v_delivery uuid;
BEGIN
  SELECT c.current_lat, c.current_lng, c.payout_fee
    INTO c_lat, c_lng, c_fee
  FROM public.couriers c
  WHERE c.id = p_courier_id
    AND c.is_active
    AND c.is_online
    AND c.current_lat IS NOT NULL
    AND c.current_lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.deliveries d2
      WHERE d2.courier_id = c.id
        AND d2.status IN ('assigned', 'picked_up', 'delivering')
    );

  IF NOT FOUND THEN
    RETURN; -- no está libre/ubicable
  END IF;

  SELECT d.id
    INTO v_delivery
  FROM public.deliveries d
  JOIN public.orders o    ON o.id = d.order_id
  JOIN public.vendors ven ON ven.id = o.vendor_id
  WHERE d.status = 'available'
    AND d.courier_id IS NULL
    AND ven.latitude IS NOT NULL
    AND ven.longitude IS NOT NULL
  ORDER BY public.haversine_km(c_lat, c_lng, ven.latitude, ven.longitude) ASC
  LIMIT 1;

  IF v_delivery IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.deliveries
     SET courier_id  = p_courier_id,
         status      = 'assigned',
         assigned_at = now(),
         fee         = COALESCE(c_fee, 0)
   WHERE id = v_delivery
     AND status = 'available'
     AND courier_id IS NULL;
END;
$$;

-- Trigger: nuevo reparto disponible → intentar auto-asignar.
CREATE OR REPLACE FUNCTION public.on_delivery_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'available' AND NEW.courier_id IS NULL THEN
    PERFORM public.auto_assign_delivery(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_delivery_available ON public.deliveries;
CREATE TRIGGER trg_on_delivery_available
  AFTER INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.on_delivery_available();

-- Trigger: repartidor se pone online / libre / mueve → darle un pendiente.
CREATE OR REPLACE FUNCTION public.on_courier_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_online AND NEW.is_active
     AND NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL
     AND (
       (OLD.is_online IS DISTINCT FROM NEW.is_online)
       OR (OLD.current_lat IS DISTINCT FROM NEW.current_lat)
       OR (OLD.current_lng IS DISTINCT FROM NEW.current_lng)
     ) THEN
    PERFORM public.try_assign_pending_to_courier(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_courier_ready ON public.couriers;
CREATE TRIGGER trg_on_courier_ready
  AFTER UPDATE ON public.couriers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_courier_ready();
