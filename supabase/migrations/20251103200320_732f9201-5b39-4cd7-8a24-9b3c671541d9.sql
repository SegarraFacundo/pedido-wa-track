-- Agregar campos de ubicación y radio de cobertura a vendors
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(5, 2) DEFAULT 5.0;

-- Agregar comentarios para documentación
COMMENT ON COLUMN public.vendors.latitude IS 'Latitud de la ubicación del negocio';
COMMENT ON COLUMN public.vendors.longitude IS 'Longitud de la ubicación del negocio';
COMMENT ON COLUMN public.vendors.delivery_radius_km IS 'Radio de cobertura de delivery en kilómetros';

-- Agregar campos de ubicación a user_sessions
ALTER TABLE public.user_sessions
ADD COLUMN IF NOT EXISTS user_latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS user_longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;

-- Función para calcular distancia entre dos puntos (fórmula de Haversine)
-- Retorna la distancia en kilómetros
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  earth_radius NUMERIC := 6371; -- Radio de la Tierra en km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  -- Verificar que todos los parámetros sean válidos
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convertir grados a radianes
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  -- Fórmula de Haversine
  a := SIN(dlat/2) * SIN(dlat/2) + 
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
       SIN(dlon/2) * SIN(dlon/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para obtener vendors dentro del radio de cobertura
CREATE OR REPLACE FUNCTION public.get_vendors_in_range(
  user_lat NUMERIC,
  user_lon NUMERIC
) RETURNS TABLE(
  vendor_id UUID,
  vendor_name TEXT,
  distance_km NUMERIC,
  delivery_radius_km NUMERIC,
  is_open BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    public.calculate_distance(user_lat, user_lon, v.latitude, v.longitude) as distance_km,
    v.delivery_radius_km,
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::TEXT = ANY(v.days_open)
        AND (CURRENT_TIME AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN v.opening_time AND v.closing_time
      THEN true
      ELSE false
    END as is_open
  FROM public.vendors v
  WHERE 
    v.is_active = true
    AND v.latitude IS NOT NULL
    AND v.longitude IS NOT NULL
    AND public.calculate_distance(user_lat, user_lon, v.latitude, v.longitude) <= COALESCE(v.delivery_radius_km, 5.0)
  ORDER BY distance_km ASC, is_open DESC;
END;
$$ LANGUAGE plpgsql STABLE;