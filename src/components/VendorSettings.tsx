import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save } from 'lucide-react';

interface VendorData {
  id: string;
  name: string;
  category: string;
  phone: string;
  whatsapp_number: string | null;
  address: string;
  is_active: boolean;
  image: string | null;
}

interface VendorSettingsProps {
  vendorId: string;
}

export function VendorSettings({ vendorId }: VendorSettingsProps) {
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchVendorData();
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      setVendorData(data);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos del negocio',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorData) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          name: vendorData.name,
          category: vendorData.category,
          phone: vendorData.phone,
          whatsapp_number: vendorData.whatsapp_number,
          address: vendorData.address,
          is_active: vendorData.is_active,
          image: vendorData.image
        })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Información actualizada correctamente'
      });
    } catch (error) {
      console.error('Error saving vendor data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la información',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vendorData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Configuración del Negocio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Negocio</Label>
            <Input
              id="name"
              value={vendorData.name}
              onChange={(e) => setVendorData({ ...vendorData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select
              value={vendorData.category}
              onValueChange={(value) => setVendorData({ ...vendorData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurante</SelectItem>
                <SelectItem value="pharmacy">Farmacia</SelectItem>
                <SelectItem value="market">Supermercado</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={vendorData.phone}
              onChange={(e) => setVendorData({ ...vendorData, phone: e.target.value })}
              placeholder="+54911234567890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
            <Input
              id="whatsapp"
              type="tel"
              value={vendorData.whatsapp_number || ''}
              onChange={(e) => setVendorData({ ...vendorData, whatsapp_number: e.target.value || null })}
              placeholder="+54911234567890"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Textarea
            id="address"
            value={vendorData.address}
            onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">URL de Imagen (opcional)</Label>
          <Input
            id="image"
            type="url"
            value={vendorData.image || ''}
            onChange={(e) => setVendorData({ ...vendorData, image: e.target.value || null })}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={vendorData.is_active}
            onCheckedChange={(checked) => setVendorData({ ...vendorData, is_active: checked })}
          />
          <Label htmlFor="active">
            Negocio activo (visible para clientes)
          </Label>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}