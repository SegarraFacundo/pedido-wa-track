-- Crear tabla de configuración de notificaciones por vendedor
CREATE TABLE IF NOT EXISTS vendor_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Tipos de notificaciones
  notify_new_order BOOLEAN DEFAULT true,
  notify_order_cancelled BOOLEAN DEFAULT true,
  notify_customer_message BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(vendor_id)
);

-- RLS policies
ALTER TABLE vendor_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their notification settings"
  ON vendor_notification_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = vendor_notification_settings.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their notification settings"
  ON vendor_notification_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = vendor_notification_settings.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert their notification settings"
  ON vendor_notification_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = vendor_notification_settings.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vendor_notification_settings_updated_at
  BEFORE UPDATE ON vendor_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Crear configuración por defecto para vendedores existentes con WhatsApp
INSERT INTO vendor_notification_settings (vendor_id, notify_new_order, notify_order_cancelled, notify_customer_message)
SELECT id, true, true, true
FROM vendors
WHERE whatsapp_number IS NOT NULL
ON CONFLICT (vendor_id) DO NOTHING;