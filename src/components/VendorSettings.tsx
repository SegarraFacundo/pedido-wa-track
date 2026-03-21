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
import { VendorNotificationSettings } from '@/components/VendorNotificationSettings';

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
  delivery_price_per_km: number;
  delivery_pricing_type: string;
  delivery_fixed_price: number;
  delivery_additional_per_km: number;
  allows_pickup?: boolean;
  pickup_instructions?: string | null;
  allows_delivery?: boolean;  // ⭐ NUEVO: permite delivery
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
  const [categories, setCategories] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchVendorData();
    fetchCategories();
  }, [vendorId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('category');

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(v => v.category))].filter(Boolean);
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

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
          image: imageUrl,
          latitude: vendorData.latitude,
          longitude: vendorData.longitude,
          delivery_radius_km: vendorData.delivery_radius_km,
          delivery_price_per_km: vendorData.delivery_price_per_km,
          delivery_pricing_type: vendorData.delivery_pricing_type,
          delivery_fixed_price: vendorData.delivery_fixed_price,
          delivery_additional_per_km: vendorData.delivery_additional_per_km,
          allows_pickup: vendorData.allows_pickup || false,
          pickup_instructions: vendorData.pickup_instructions || null,
          allows_delivery: vendorData.allows_delivery ?? true  // ⭐ NUEVO
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
    <div className="space-y-6">
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
              <SelectContent className="bg-background z-50">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="delivery_pricing_type">Tipo de Cobro de Delivery</Label>
              <Select
                value={vendorData.delivery_pricing_type || 'per_km'}
                onValueChange={(value) => setVendorData({ ...vendorData, delivery_pricing_type: value })}
              >
                <SelectTrigger id="delivery_pricing_type">
                  <SelectValue placeholder="Seleccionar tipo de cobro" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="per_km">Por Kilómetro Total</SelectItem>
                  <SelectItem value="fixed">Monto Fijo</SelectItem>
                  <SelectItem value="base_plus_km">Base + Adicional por Km</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vendorData.delivery_pricing_type === 'per_km' && (
              <div className="space-y-2">
                <Label htmlFor="delivery_price">Precio por Kilómetro ($)</Label>
                <Input
                  id="delivery_price"
                  type="number"
                  step="100"
                  min="0"
                  value={vendorData.delivery_price_per_km || 0}
                  onChange={(e) => setVendorData({ ...vendorData, delivery_price_per_km: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  💰 Se multiplica la distancia total por este valor
                </p>
              </div>
            )}

            {vendorData.delivery_pricing_type === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="delivery_fixed_price">Precio Fijo de Delivery ($)</Label>
                <Input
                  id="delivery_fixed_price"
                  type="number"
                  step="100"
                  min="0"
                  value={vendorData.delivery_fixed_price || 0}
                  onChange={(e) => setVendorData({ ...vendorData, delivery_fixed_price: parseFloat(e.target.value) || 0 })}
                  placeholder="Ej: 1000"
                />
                <p className="text-xs text-muted-foreground">
                  💰 Todos los deliveries cuestan lo mismo, sin importar la distancia
                </p>
              </div>
            )}

            {vendorData.delivery_pricing_type === 'base_plus_km' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="delivery_fixed_price_base">Precio Base (Primer Km) ($)</Label>
                  <Input
                    id="delivery_fixed_price_base"
                    type="number"
                    step="100"
                    min="0"
                    value={vendorData.delivery_fixed_price || 0}
                    onChange={(e) => setVendorData({ ...vendorData, delivery_fixed_price: parseFloat(e.target.value) || 0 })}
                    placeholder="Ej: 1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    💰 Precio dentro del primer kilómetro
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_additional_per_km">Precio Adicional por Km ($)</Label>
                  <Input
                    id="delivery_additional_per_km"
                    type="number"
                    step="100"
                    min="0"
                    value={vendorData.delivery_additional_per_km || 0}
                    onChange={(e) => setVendorData({ ...vendorData, delivery_additional_per_km: parseFloat(e.target.value) || 0 })}
                    placeholder="Ej: 500"
                  />
                  <p className="text-xs text-muted-foreground">
                    💰 Se suma por cada kilómetro después del primero
                  </p>
                </div>
              </>
            )}
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

        {/* ⭐ SECCIÓN: Opciones de Entrega */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-4">🚚 Opciones de Entrega</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configurá cómo los clientes pueden recibir sus pedidos. Debe estar habilitada al menos una opción.
          </p>
          
          {/* Validación: al menos uno debe estar activo */}
          {!vendorData.allows_delivery && !vendorData.allows_pickup && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg mb-4 text-sm">
              ⚠️ Debes habilitar al menos una opción de entrega (Delivery o Retiro en local)
            </div>
          )}
          
          <div className="space-y-4">
            {/* Delivery */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="allows_delivery"
                  checked={vendorData.allows_delivery ?? true}
                  onCheckedChange={(checked) => {
                    // No permitir desactivar si pickup tampoco está activo
                    if (!checked && !vendorData.allows_pickup) {
                      return;
                    }
                    setVendorData({ ...vendorData, allows_delivery: checked });
                  }}
                />
                <Label htmlFor="allows_delivery" className="font-medium">
                  🚚 Permite Delivery (envío a domicilio)
                </Label>
              </div>
              {(vendorData.allows_delivery ?? true) && (
                <p className="text-xs text-muted-foreground pl-6">
                  Los clientes pueden recibir sus pedidos en su dirección
                </p>
              )}
            </div>
            
            {/* Pickup */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="allows_pickup"
                  checked={vendorData.allows_pickup || false}
                  onCheckedChange={(checked) => {
                    // No permitir desactivar si delivery tampoco está activo
                    if (!checked && !(vendorData.allows_delivery ?? true)) {
                      return;
                    }
                    setVendorData({ ...vendorData, allows_pickup: checked });
                  }}
                />
                <Label htmlFor="allows_pickup" className="font-medium">
                  🏪 Permite Retiro en Local
                </Label>
              </div>
              
              {vendorData.allows_pickup && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="pickup_instructions">Instrucciones para retiro (opcional)</Label>
                  <Textarea
                    id="pickup_instructions"
                    value={vendorData.pickup_instructions || ''}
                    onChange={(e) => setVendorData({ ...vendorData, pickup_instructions: e.target.value })}
                    placeholder="Ej: Retirar por la puerta lateral, horario de 9 a 18hs"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Estas instrucciones se mostrarán a los clientes cuando elijan retiro en local
                  </p>
                </div>
              )}
            </div>
          </div>
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
    
    <VendorNotificationSettings 
      vendorId={vendorId} 
      hasWhatsApp={!!vendorData.whatsapp_number}
    />
    </div>
  );
}