-- Refresh types for commission invoices system
-- This migration ensures the types are regenerated for the new tables

-- Add comment to trigger types refresh
COMMENT ON TABLE commission_invoices IS 'Stores generated commission invoices for vendors';
COMMENT ON TABLE commission_invoice_items IS 'Links commission records to invoices';
COMMENT ON FUNCTION generate_invoice_number() IS 'Generates sequential invoice numbers per year';