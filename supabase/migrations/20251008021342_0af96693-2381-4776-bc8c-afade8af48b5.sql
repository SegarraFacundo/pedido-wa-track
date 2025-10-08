-- Agregar campo para indicar si está abierto 24 horas
ALTER TABLE vendor_hours
ADD COLUMN is_open_24_hours BOOLEAN DEFAULT false;