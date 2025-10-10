-- Actualizar función get_products_by_category para usar zona horaria de Argentina
CREATE OR REPLACE FUNCTION public.get_products_by_category(category_filter text DEFAULT NULL)
RETURNS TABLE(
  vendor_id uuid,
  vendor_name text,
  product_id uuid,
  product_name text,
  product_description text,
  product_price numeric,
  product_category text,
  is_available boolean,
  vendor_rating numeric,
  vendor_is_open boolean
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
    p.category as product_category,
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
    AND (category_filter IS NULL OR LOWER(p.category) LIKE LOWER('%' || category_filter || '%'))
  ORDER BY vendor_is_open DESC, v.average_rating DESC, p.price ASC;
END;
$$;