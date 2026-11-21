-- ============================================================
-- Rol nuevo: repartidor. (Se agrega en su propia migración porque el valor
-- del enum debe estar committeado antes de usarse en RLS de otras tablas.)
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'repartidor';
