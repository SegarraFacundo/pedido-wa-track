import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Building2, Banknote, Check, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PaymentSettings {
  efectivo: boolean;
  transferencia: {
    activo: boolean;
    alias: string | null;
    cbu: string | null;
    titular: string | null;
  };
  mercadoPago: {
    activo: boolean;
    user_id: string | null;
    access_token: string | null;
    refresh_token: string | null;
    fecha_expiracion_token: string | null;
  };
}

interface VendorPaymentSettingsProps {
  vendorId: string;
}

export function VendorPaymentSettings({ vendorId }: VendorPaymentSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    efectivo: true,
    transferencia: {
      activo: false,
      alias: null,
      cbu: null,
      titular: null,
    },
    mercadoPago: {
      activo: false,
      user_id: null,
      access_token: null,
      refresh_token: null,
      fecha_expiracion_token: null,
    },
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  // Detectar callbacks de MercadoPago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpConnected = params.get('mp_connected');
    const mpError = params.get('mp_error');

    if (mpConnected === 'true') {
      toast({
        title: '¡MercadoPago conectado!',
        description: 'Tu cuenta de MercadoPago se conectó exitosamente',
      });
      loadSettings(); // Recargar settings para ver la conexión
      // Limpiar URL
      window.history.replaceState({}, '', '/vendor-dashboard');
    }

    if (mpError) {
      toast({
        title: 'Error al conectar MercadoPago',
        description: decodeURIComponent(mpError),
        variant: 'destructive',
      });
      // Limpiar URL
      window.history.replaceState({}, '', '/vendor-dashboard');
    }
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('payment_settings')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      if (data?.payment_settings) {
        setSettings(data.payment_settings as unknown as PaymentSettings);
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de pagos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    // Validar que si transferencia está activa, tenga todos los datos
    if (settings.transferencia.activo) {
      const { alias, cbu, titular } = settings.transferencia;
      if (!alias || !cbu || !titular) {
        toast({
          title: 'Datos incompletos',
          description: 'Para activar transferencia bancaria, completá Alias, CBU/CVU y Titular',
          variant: 'destructive',
        });
        return;
      }
      
      // Validar que no estén vacíos después de trim
      if (alias.trim() === '' || cbu.trim() === '' || titular.trim() === '') {
        toast({
          title: 'Datos incompletos',
          description: 'Ningún campo puede estar vacío',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ payment_settings: settings as any })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: 'Configuración guardada',
        description: 'Los medios de pago se actualizaron correctamente',
      });
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const connectMercadoPago = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mercadopago-auth-url', {
        body: { vendorId },
      });

      if (error) throw error;

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error('No se pudo obtener la URL de autorización');
      }
    } catch (error) {
      console.error('Error connecting MercadoPago:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la conexión con MercadoPago',
        variant: 'destructive',
      });
    }
  };

  const disconnectMercadoPago = async () => {
    const updatedSettings = {
      ...settings,
      mercadoPago: {
        activo: false,
        user_id: null,
        access_token: null,
        refresh_token: null,
        fecha_expiracion_token: null,
      },
    };

    setSettings(updatedSettings);
    
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ payment_settings: updatedSettings as any })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: 'MercadoPago desconectado',
        description: 'Se desvinculó tu cuenta de MercadoPago',
      });
    } catch (error) {
      console.error('Error disconnecting MercadoPago:', error);
      toast({
        title: 'Error',
        description: 'No se pudo desconectar MercadoPago',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 flex-shrink-0 text-primary" />
            Configuración de Pagos
          </CardTitle>
          <CardDescription>
            Configura los medios de pago que aceptarás en tu negocio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MercadoPago */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Label className="text-base font-semibold">MercadoPago</Label>
                <p className="text-sm text-muted-foreground">
                  Acepta pagos online con tarjeta y otros medios
                </p>
              </div>
              {settings.mercadoPago.activo ? (
                <div className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                  <Check className="h-3.5 w-3.5" />
                  Conectado
                </div>
              ) : (
                <div className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  No conectado
                </div>
              )}
            </div>

            {settings.mercadoPago.activo ? (
              <div className="space-y-2">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm">
                    <span className="font-medium">Usuario ID:</span>{' '}
                    {settings.mercadoPago.user_id}
                  </p>
                  {settings.mercadoPago.fecha_expiracion_token && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Token válido hasta:{' '}
                      {new Date(settings.mercadoPago.fecha_expiracion_token).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={disconnectMercadoPago}
                  className="w-full"
                >
                  Desconectar MercadoPago
                </Button>
              </div>
            ) : (
              <Button onClick={connectMercadoPago} className="w-full">
                🔗 Conectar con MercadoPago
              </Button>
            )}
          </div>

          <Separator />

          {/* Transferencia */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Transferencia Bancaria
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe pagos por transferencia directa
                </p>
              </div>
              <Switch
                checked={settings.transferencia.activo}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    transferencia: { ...settings.transferencia, activo: checked },
                  })
                }
              />
            </div>

            {settings.transferencia.activo && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias</Label>
                  <Input
                    id="alias"
                    value={settings.transferencia.alias || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transferencia: {
                          ...settings.transferencia,
                          alias: e.target.value,
                        },
                      })
                    }
                    placeholder="ej: mi.negocio.mp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cbu">CBU / CVU</Label>
                  <Input
                    id="cbu"
                    value={settings.transferencia.cbu || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transferencia: {
                          ...settings.transferencia,
                          cbu: e.target.value,
                        },
                      })
                    }
                    placeholder="0000003100010000000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="titular">Titular</Label>
                  <Input
                    id="titular"
                    value={settings.transferencia.titular || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        transferencia: {
                          ...settings.transferencia,
                          titular: e.target.value,
                        },
                      })
                    }
                    placeholder="Nombre del titular de la cuenta"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Efectivo */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Efectivo
              </Label>
              <p className="text-sm text-muted-foreground">
                Acepta pagos en efectivo al momento de la entrega
              </p>
            </div>
            <Switch
              checked={settings.efectivo}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, efectivo: checked })
              }
            />
          </div>

          <Button
            onClick={saveSettings}
            disabled={saving}
            className="w-full"
            size="lg"
          >
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
    </div>
  );
}
