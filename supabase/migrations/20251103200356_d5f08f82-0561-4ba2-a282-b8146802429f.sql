-- Actualizar funciones con search_path seguro
DROP FUNCTION IF EXISTS public.calculate_distance(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
CREATE FUNCTION public.calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
) RETURNS NUMERIC 
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

DROP FUNCTION IF EXISTS public.get_vendors_in_range(NUMERIC, NUMERIC);
CREATE FUNCTION public.get_vendors_in_range(
  user_lat NUMERIC,
  user_lon NUMERIC
) RETURNS TABLE(
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
BEGIN
  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    calculate_distance(user_lat, user_lon, v.latitude, v.longitude) as distance_km,
    v.delivery_radius_km,
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::TEXT = ANY(v.days_open)
        AND (CURRENT_TIME AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN v.opening_time AND v.closing_time
      THEN true
      ELSE false
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