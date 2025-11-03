-- Agregar campo para soportar múltiples rangos horarios por día
ALTER TABLE vendor_hours
ADD COLUMN slot_number INTEGER DEFAULT 1;

-- Eliminar la restricción única anterior si existe
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vendor_hours_vendor_id_day_of_week_key'
  ) THEN
    ALTER TABLE vendor_hours DROP CONSTRAINT vendor_hours_vendor_id_day_of_week_key;
  END IF;
END $$;

-- Agregar nueva restricción única que incluya el slot_number
ALTER TABLE vendor_hours
ADD CONSTRAINT vendor_hours_vendor_id_day_slot_unique 
UNIQUE (vendor_id, day_of_week, slot_number);

-- Crear índice para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_vendor_hours_vendor_day 
ON vendor_hours (vendor_id, day_of_week);