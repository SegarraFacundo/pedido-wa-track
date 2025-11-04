-- Remove the category check constraint completely to allow any category value
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_category_check;