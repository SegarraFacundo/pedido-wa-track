-- Agregar rol 'soporte' al enum existente
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'soporte';