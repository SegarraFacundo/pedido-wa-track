import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Bot, 
  Power, 
  RefreshCw, 
  Shield, 
  Users, 
  MessageSquare, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  WifiOff,
  Store,
  HeadphonesIcon,
  Bell,
  Mail,
  Phone,
  Send,
  Plus,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PlatformSettings {
  id: string;
  bot_enabled: boolean;
  emergency_mode: boolean;
  emergency_message: string;
  fallback_mode: 'vendor_direct' | 'support_queue' | 'offline';
  last_error: string | null;
  error_count: number;
  last_error_at: string | null;
  auto_emergency_threshold: number;
  created_at: string;
  updated_at: string;
}

interface ErrorLog {
  id: string;
  error_type: string;
  error_message: string;
  error_details: Record<string, unknown> | null;
  customer_phone: string | null;
  vendor_id: string | null;
  resolved: boolean;
  created_at: string;
}

interface EmergencyContact {
  id: string;
  user_id: string;
  email: string;
  phone: string | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
}

export default function EmergencyControl() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchErrorLogs();
    fetchEmergencyContacts();

    // Subscribe to real-time changes
    const settingsChannel = supabase
      .channel('platform_settings_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'platform_settings' 
      }, () => {
        fetchSettings();
      })
      .subscribe();

    const errorLogsChannel = supabase
      .channel('error_logs_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bot_error_logs' 
      }, () => {
        fetchErrorLogs();
      })
      .subscribe();

    const contactsChannel = supabase
      .channel('emergency_contacts_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'admin_emergency_contacts' 
      }, () => {
        fetchEmergencyContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(errorLogsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) throw error;
      
      setSettings(data as PlatformSettings);
      setEmergencyMessage(data?.emergency_message || '');
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setErrorLogs((data || []) as ErrorLog[]);
    } catch (error) {
      console.error('Error fetching error logs:', error);
    }
  };

  const fetchEmergencyContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_emergency_contacts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEmergencyContacts((data || []) as EmergencyContact[]);
    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
    }
  };

  const updateEmergencyContact = async (contactId: string, updates: Partial<EmergencyContact>) => {
    try {
      const { error } = await supabase
        .from('admin_emergency_contacts')
        .update(updates)
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Contacto actualizado');
      await fetchEmergencyContacts();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Error al actualizar contacto');
    }
  };

  const addPhoneToContact = async (contactId: string) => {
    if (!newContactPhone.trim()) {
      toast.error('Ingresa un número de teléfono');
      return;
    }

    // Format phone number
    let phone = newContactPhone.trim();
    if (!phone.startsWith('+')) {
      phone = '+54' + phone.replace(/^0/, '');
    }

    await updateEmergencyContact(contactId, { phone });
    setNewContactPhone('');
  };

  const sendTestNotification = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-admin-emergency', {
        body: {
          error_type: 'TEST_NOTIFICATION',
          error_message: 'Esta es una notificación de prueba del sistema de alertas de emergencia.',
          error_count: 0,
          threshold: 3,
        },
      });

      if (error) throw error;

      toast.success(`Notificación de prueba enviada: ${data.emails_sent} emails, ${data.whatsapps_sent} WhatsApps`);
    } catch (error: any) {
      console.error('Error sending test notification:', error);
      toast.error('Error al enviar notificación de prueba');
    } finally {
      setSendingTest(false);
    }
  };

  const updateSettings = async (updates: Partial<PlatformSettings>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update(updates)
        .eq('id', 'global');

      if (error) throw error;
      
      toast.success('Configuración actualizada');
      await fetchSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Error al actualizar configuración');
    } finally {
      setSaving(false);
    }
  };

  const toggleBotEnabled = () => {
    if (!settings) return;
    updateSettings({ bot_enabled: !settings.bot_enabled });
  };

  const toggleEmergencyMode = () => {
    if (!settings) return;
    updateSettings({ 
      emergency_mode: !settings.emergency_mode,
      // Reset error count when manually toggling
      error_count: !settings.emergency_mode ? settings.error_count : 0
    });
  };

  const updateFallbackMode = (mode: 'vendor_direct' | 'support_queue' | 'offline') => {
    updateSettings({ fallback_mode: mode });
  };

  const saveEmergencyMessage = () => {
    updateSettings({ emergency_message: emergencyMessage });
  };

  const resetErrorCounters = async () => {
    await updateSettings({ 
      error_count: 0, 
      last_error: null, 
      last_error_at: null 
    });
    toast.success('Contadores reseteados');
  };

  const markErrorResolved = async (errorId: string) => {
    try {
      const { error } = await supabase
        .from('bot_error_logs')
        .update({ resolved: true })
        .eq('id', errorId);

      if (error) throw error;
      
      toast.success('Error marcado como resuelto');
      fetchErrorLogs();
    } catch (error) {
      console.error('Error marking resolved:', error);
      toast.error('Error al actualizar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unresolvedErrors = errorLogs.filter(e => !e.resolved);
  const last24hErrors = errorLogs.filter(e => {
    const errorDate = new Date(e.created_at);
    const now = new Date();
    return (now.getTime() - errorDate.getTime()) < 24 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      {settings?.emergency_mode && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">
            ⚠️ MODO EMERGENCIA ACTIVO
          </AlertTitle>
          <AlertDescription>
            El bot está en modo de contingencia. Los mensajes se están manejando según el modo de fallback configurado.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bot Status Card */}
        <Card className={settings?.bot_enabled ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <CardTitle>Estado del Bot</CardTitle>
              </div>
              <Badge variant={settings?.bot_enabled ? 'default' : 'destructive'}>
                {settings?.bot_enabled ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Activo</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Desactivado</>
                )}
              </Badge>
            </div>
            <CardDescription>
              Controla si el bot de IA responde a los mensajes de WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="bot-enabled"
                  checked={settings?.bot_enabled}
                  onCheckedChange={toggleBotEnabled}
                  disabled={saving}
                />
                <Label htmlFor="bot-enabled">
                  {settings?.bot_enabled ? 'Bot habilitado' : 'Bot deshabilitado'}
                </Label>
              </div>
              <Power className={`h-6 w-6 ${settings?.bot_enabled ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Mode Card */}
        <Card className={settings?.emergency_mode ? 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Modo Emergencia</CardTitle>
              </div>
              <Badge variant={settings?.emergency_mode ? 'destructive' : 'outline'}>
                {settings?.emergency_mode ? (
                  <><AlertTriangle className="h-3 w-3 mr-1" /> ACTIVO</>
                ) : (
                  'Normal'
                )}
              </Badge>
            </div>
            <CardDescription>
              Activa el modo de contingencia cuando hay problemas con la IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="emergency-mode"
                  checked={settings?.emergency_mode}
                  onCheckedChange={toggleEmergencyMode}
                  disabled={saving}
                />
                <Label htmlFor="emergency-mode">
                  {settings?.emergency_mode ? 'Emergencia activa' : 'Modo normal'}
                </Label>
              </div>
              <AlertTriangle className={`h-6 w-6 ${settings?.emergency_mode ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fallback Mode Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Modo de Fallback</CardTitle>
          </div>
          <CardDescription>
            Cuando el bot está desactivado o en emergencia, ¿cómo se manejan los mensajes?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings?.fallback_mode}
            onValueChange={(value) => updateFallbackMode(value as 'vendor_direct' | 'support_queue' | 'offline')}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="vendor_direct" id="vendor_direct" />
              <div className="flex-1">
                <Label htmlFor="vendor_direct" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Store className="h-4 w-4 text-green-600" />
                  Directo al Vendor
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Si el cliente tiene un pedido activo, los mensajes van directamente al negocio. 
                  Si no, se crea un ticket de soporte.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="support_queue" id="support_queue" />
              <div className="flex-1">
                <Label htmlFor="support_queue" className="flex items-center gap-2 font-medium cursor-pointer">
                  <HeadphonesIcon className="h-4 w-4 text-blue-600" />
                  Cola de Soporte
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Todos los mensajes se convierten en tickets de soporte para que el equipo los atienda manualmente.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="offline" id="offline" />
              <div className="flex-1">
                <Label htmlFor="offline" className="flex items-center gap-2 font-medium cursor-pointer">
                  <WifiOff className="h-4 w-4 text-red-600" />
                  Offline (Solo mensaje)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Solo se envía el mensaje de emergencia. No se procesan los mensajes entrantes.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Emergency Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Mensaje de Emergencia</CardTitle>
          </div>
          <CardDescription>
            Este mensaje se envía a los clientes cuando el bot no puede procesar sus solicitudes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={emergencyMessage}
            onChange={(e) => setEmergencyMessage(e.target.value)}
            placeholder="Escribe el mensaje que verán los clientes..."
            rows={4}
          />
          <div className="flex justify-end">
            <Button 
              onClick={saveEmergencyMessage}
              disabled={saving || emergencyMessage === settings?.emergency_message}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar Mensaje
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Contactos de Emergencia</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={sendTestNotification}
              disabled={sendingTest || emergencyContacts.length === 0}
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Prueba
            </Button>
          </div>
          <CardDescription>
            Estos contactos recibirán notificaciones cuando el modo emergencia se active automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emergencyContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay contactos de emergencia configurados</p>
              <p className="text-sm mt-1">Los administradores aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emergencyContacts.map((contact) => (
                <div 
                  key={contact.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Email */}
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{contact.email}</span>
                        <div className="flex items-center gap-2 ml-auto">
                          <Switch
                            id={`email-${contact.id}`}
                            checked={contact.notify_email}
                            onCheckedChange={(checked) => 
                              updateEmergencyContact(contact.id, { notify_email: checked })
                            }
                          />
                          <Label htmlFor={`email-${contact.id}`} className="text-xs">
                            Email
                          </Label>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {contact.phone ? (
                          <>
                            <span className="text-sm">{contact.phone}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateEmergencyContact(contact.id, { phone: null })}
                              className="h-6 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="+5493435123456"
                              value={newContactPhone}
                              onChange={(e) => setNewContactPhone(e.target.value)}
                              className="h-8 w-40 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addPhoneToContact(contact.id)}
                              className="h-8"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Agregar
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                          <Switch
                            id={`wa-${contact.id}`}
                            checked={contact.notify_whatsapp}
                            disabled={!contact.phone}
                            onCheckedChange={(checked) => 
                              updateEmergencyContact(contact.id, { notify_whatsapp: checked })
                            }
                          />
                          <Label htmlFor={`wa-${contact.id}`} className="text-xs">
                            WhatsApp
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 mt-3">
                    {contact.notify_email && (
                      <Badge variant="outline" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Email activo
                      </Badge>
                    )}
                    {contact.notify_whatsapp && contact.phone && (
                      <Badge variant="outline" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        WhatsApp activo
                      </Badge>
                    )}
                    {!contact.notify_email && !contact.notify_whatsapp && (
                      <Badge variant="secondary" className="text-xs">
                        Sin notificaciones
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Estadísticas de Errores</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={resetErrorCounters}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resetear Contadores
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-red-600">{settings?.error_count || 0}</div>
              <div className="text-sm text-muted-foreground">Errores consecutivos</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-orange-600">{last24hErrors.length}</div>
              <div className="text-sm text-muted-foreground">Errores (24h)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-yellow-600">{unresolvedErrors.length}</div>
              <div className="text-sm text-muted-foreground">Sin resolver</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">{settings?.auto_emergency_threshold || 3}</div>
              <div className="text-sm text-muted-foreground">Umbral auto-emergencia</div>
            </div>
          </div>

          {settings?.last_error && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
                <Clock className="h-4 w-4" />
                Último error: {settings.last_error_at 
                  ? format(new Date(settings.last_error_at), "dd MMM yyyy HH:mm:ss", { locale: es })
                  : 'N/A'}
              </div>
              <code className="text-sm text-red-700 dark:text-red-400 break-all">
                {settings.last_error}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Log de Errores Recientes</CardTitle>
          <CardDescription>
            Últimos 50 errores registrados del bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No hay errores registrados</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {errorLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-4 rounded-lg border ${
                      log.resolved 
                        ? 'bg-muted/30 border-muted' 
                        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={log.resolved ? 'outline' : 'destructive'}>
                            {log.error_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: es })}
                          </span>
                        </div>
                        <p className="text-sm break-all">{log.error_message}</p>
                        {log.customer_phone && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Cliente: {log.customer_phone}
                          </p>
                        )}
                      </div>
                      {!log.resolved && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markErrorResolved(log.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
