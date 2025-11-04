-- Función temporal para limpiar arrays anidados
CREATE OR REPLACE FUNCTION fix_nested_arrays() RETURNS void AS $$
DECLARE
  prod RECORD;
  cleaned_category TEXT[];
BEGIN
  FOR prod IN SELECT id, category FROM products WHERE array_length(category, 1) > 0 LOOP
    -- Intentar extraer el primer elemento si es un array anidado
    BEGIN
      -- Si category[1] es un array string como "[Plantas]", extraerlo
      IF category[1] LIKE '[%]' THEN
        cleaned_category := string_to_array(
          trim(both '[]' from category[1]),
          ','
        );
        
        UPDATE products 
        SET category = cleaned_category
        WHERE id = prod.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla, skip
      NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función
SELECT fix_nested_arrays();

-- Eliminar la función temporal
DROP FUNCTION fix_nested_arrays();