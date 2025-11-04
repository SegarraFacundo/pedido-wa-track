-- Corregir el manejo de zonas horarias en get_vendors_in_range
CREATE OR REPLACE FUNCTION public.get_vendors_in_range(user_lat numeric, user_lon numeric)
 RETURNS TABLE(vendor_id uuid, vendor_name text, distance_km numeric, delivery_radius_km numeric, is_open boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  current_day_name TEXT;
  current_time_arg TIME;
BEGIN
  -- Obtener el día actual en Argentina
  SELECT LOWER(TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Day'))
  INTO current_day_name;
  -- Remover espacios en blanco
  current_day_name := TRIM(current_day_name);
  
  -- Obtener la hora actual en Argentina como TIME (sin zona horaria)
  current_time_arg := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;

  RETURN QUERY
  SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    calculate_distance(user_lat, user_lon, v.latitude, v.longitude) as distance_km,
    v.delivery_radius_km,
    CASE 
      -- Si tiene horarios en vendor_hours, usar esos
      WHEN EXISTS (
        SELECT 1 FROM vendor_hours vh 
        WHERE vh.vendor_id = v.id 
        AND LOWER(vh.day_of_week) = current_day_name
      ) THEN (
        -- Verificar si ALGÚN slot está abierto en este momento
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
      -- Si no tiene vendor_hours, usar horarios legacy de vendors
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
$function$;