-- Recreate views with explicit SECURITY INVOKER to fully resolve linter warning

-- Drop and recreate public_vendors with SECURITY INVOKER
DROP VIEW IF EXISTS public_vendors CASCADE;
CREATE VIEW public_vendors 
WITH (security_invoker = on) AS
SELECT id,
    name,
    category,
    average_rating AS rating,
    opening_time,
    closing_time,
    days_open,
    image,
    CASE
        WHEN (address IS NOT NULL) THEN (split_part(address, ','::text, 1) ||
        CASE
            WHEN (array_length(string_to_array(address, ','::text), 1) > 1) THEN (', '::text || TRIM(BOTH FROM split_part(address, ','::text, array_length(string_to_array(address, ','::text), 1))))
            ELSE ''::text
        END)
        ELSE NULL::text
    END AS address_area,
    total_orders,
    joined_at,
    is_active,
    (EXISTS ( SELECT 1
       FROM products p
      WHERE ((p.vendor_id = vendors.id) AND (p.is_available = true)))) AS has_products,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price, 'category', p.category)) AS jsonb_agg
       FROM ( SELECT products.name,
                products.price,
                products.category
           FROM products
          WHERE ((products.vendor_id = vendors.id) AND (products.is_available = true))
         LIMIT 5) p), '[]'::jsonb) AS available_products
FROM vendors
WHERE (is_active = true);

-- Drop and recreate vendor_reviews_public with SECURITY INVOKER
DROP VIEW IF EXISTS vendor_reviews_public CASCADE;
CREATE VIEW vendor_reviews_public
WITH (security_invoker = on) AS
SELECT id,
    vendor_id,
    rating,
    comment,
    CASE
        WHEN ((customer_name IS NOT NULL) AND (customer_name <> ''::text)) THEN concat(split_part(customer_name, ' '::text, 1), ' ',
        CASE
            WHEN (array_length(string_to_array(customer_name, ' '::text), 1) > 1) THEN concat(upper("substring"(split_part(customer_name, ' '::text, 2), 1, 1)), '.')
            ELSE ''::text
        END)
        ELSE 'Anonymous'::text
    END AS customer_name,
    NULL::text AS customer_phone,
    created_at
FROM vendor_reviews;

-- Drop and recreate vendor_details with SECURITY INVOKER  
DROP VIEW IF EXISTS vendor_details CASCADE;
CREATE VIEW vendor_details
WITH (security_invoker = on) AS
SELECT id,
    name,
    category,
    phone,
    address,
    is_active,
    rating,
    total_orders,
    joined_at,
    image,
    user_id,
    created_at,
    updated_at,
    whatsapp_number,
    opening_time,
    closing_time,
    available_products,
    days_open,
    average_rating,
    total_reviews,
    CASE
        WHEN (user_id = auth.uid()) THEN phone
        ELSE NULL::text
    END AS full_phone,
    CASE
        WHEN (user_id = auth.uid()) THEN whatsapp_number
        ELSE NULL::text
    END AS full_whatsapp,
    CASE
        WHEN (user_id = auth.uid()) THEN address
        ELSE get_simplified_address(address)
    END AS full_address
FROM vendors;

-- Drop and recreate vendor_orders_view with SECURITY INVOKER
DROP VIEW IF EXISTS vendor_orders_view CASCADE;
CREATE VIEW vendor_orders_view
WITH (security_invoker = on) AS
SELECT id,
    vendor_id,
    status,
    items,
    total,
    notes,
    delivery_person_name,
    delivery_person_phone,
    created_at,
    updated_at,
    estimated_delivery,
    coordinates,
    get_masked_phone(customer_phone) AS customer_phone_masked,
    (SUBSTRING(customer_name FROM 1 FOR 3) || '***'::text) AS customer_name_masked,
    get_simplified_address(address) AS address_simplified
FROM orders;