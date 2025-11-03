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
import { Building2, Save, Upload, X } from 'lucide-react';

interface VendorData {
  id: string;
  name: string;
  category: string;
  phone: string;
  whatsapp_number: string | null;
  address: string;
  is_active: boolean;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number;
}

interface VendorSettingsProps {
  vendorId: string;
}

export function VendorSettings({ vendorId }: VendorSettingsProps) {
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${vendorId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-images')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vendor-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen',
        variant: 'destructive'
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setVendorData({ ...vendorData!, image: null });
  };

  const handleSave = async () => {
    if (!vendorData) return;

    setSaving(true);
    try {
      let imageUrl = vendorData.image;

      // Upload new image if selected
      if (imageFile) {
        const uploadedUrl = await handleImageUpload();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('vendors')
        .update({
          name: vendorData.name,
          category: vendorData.category,
          phone: vendorData.phone,
          whatsapp_number: vendorData.whatsapp_number,
          address: vendorData.address,
          is_active: vendorData.is_active,
          image: imageUrl
        })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Información actualizada correctamente'
      });

      setImageFile(null);
      setImagePreview(null);
      fetchVendorData();
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

        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-4">📍 Ubicación y Radio de Cobertura</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configurá tu ubicación y radio para que los clientes vean si estás en su zona de delivery.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitud</Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={vendorData.latitude || ''}
                onChange={(e) => setVendorData({ ...vendorData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="-27.123456"
              />
              <p className="text-xs text-muted-foreground">
                Ej: -27.451944
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitud</Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={vendorData.longitude || ''}
                onChange={(e) => setVendorData({ ...vendorData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="-58.987654"
              />
              <p className="text-xs text-muted-foreground">
                Ej: -58.983194
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_radius">Radio de Cobertura (km)</Label>
              <Input
                id="delivery_radius"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={vendorData.delivery_radius_km}
                onChange={(e) => setVendorData({ ...vendorData, delivery_radius_km: parseFloat(e.target.value) || 5.0 })}
              />
              <p className="text-xs text-muted-foreground">
                Distancia máxima: {vendorData.delivery_radius_km} km
              </p>
            </div>
          </div>

          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-sm">
              💡 <strong>Cómo obtener tus coordenadas:</strong>
            </p>
            <ol className="text-sm list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Abrí Google Maps en tu navegador</li>
              <li>Buscá la dirección de tu negocio</li>
              <li>Hacé clic derecho en el marcador</li>
              <li>Seleccioná las coordenadas que aparecen (formato: -27.123456, -58.987654)</li>
              <li>Pegá el primer número en Latitud y el segundo en Longitud</li>
            </ol>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Imagen del Negocio (opcional)</Label>
          {(imagePreview || vendorData.image) && (
            <div className="relative w-32 h-32 mb-2">
              <img 
                src={imagePreview || vendorData.image!} 
                alt="Preview" 
                className="w-full h-full object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">
            Formatos aceptados: JPG, PNG, WEBP (máx 5MB)
          </p>
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