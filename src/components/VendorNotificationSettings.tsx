import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";

interface VendorNotificationSettingsProps {
  vendorId: string;
  hasWhatsApp: boolean;
}

interface NotificationSettings {
  notify_new_order: boolean;
  notify_order_cancelled: boolean;
  notify_customer_message: boolean;
}

export function VendorNotificationSettings({ vendorId, hasWhatsApp }: VendorNotificationSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    notify_new_order: true,
    notify_order_cancelled: true,
    notify_customer_message: true,
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendor_notification_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          notify_new_order: data.notify_new_order,
          notify_order_cancelled: data.notify_order_cancelled,
          notify_customer_message: data.notify_customer_message,
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      toast.error('Error al cargar configuración de notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('vendor_notification_settings')
        .upsert({
          vendor_id: vendorId,
          ...settings,
        }, {
          onConflict: 'vendor_id'
        });

      if (error) throw error;

      toast.success('Configuración de notificaciones guardada');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (!hasWhatsApp) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones por WhatsApp
          </CardTitle>
          <CardDescription>
            Para recibir notificaciones por WhatsApp, primero debes agregar tu número de WhatsApp en la configuración del negocio.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones por WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificaciones por WhatsApp
        </CardTitle>
        <CardDescription>
          Configura qué notificaciones deseas recibir en tu WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_new_order">Nuevos Pedidos</Label>
              <p className="text-sm text-muted-foreground">
                Recibe una notificación cuando llegue un nuevo pedido
              </p>
            </div>
            <Switch
              id="notify_new_order"
              checked={settings.notify_new_order}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_new_order: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_order_cancelled">Pedidos Cancelados</Label>
              <p className="text-sm text-muted-foreground">
                Recibe una notificación cuando un cliente cancele un pedido
              </p>
            </div>
            <Switch
              id="notify_order_cancelled"
              checked={settings.notify_order_cancelled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_order_cancelled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_customer_message">Mensajes de Clientes</Label>
              <p className="text-sm text-muted-foreground">
                Recibe una notificación cuando un cliente quiera hablar contigo
              </p>
            </div>
            <Switch
              id="notify_customer_message"
              checked={settings.notify_customer_message}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_customer_message: checked })
              }
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar Configuración'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
