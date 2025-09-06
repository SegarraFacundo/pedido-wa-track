import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit, Plus, Tag, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface VendorOffer {
  id: string;
  title: string;
  description: string;
  discount_percentage?: number;
  original_price?: number;
  offer_price?: number;
  is_active: boolean;
  valid_from: Date;
  valid_until?: Date;
}

interface VendorOffersManagerProps {
  vendorId: string;
}

export function VendorOffersManager({ vendorId }: VendorOffersManagerProps) {
  const [offers, setOffers] = useState<VendorOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<VendorOffer | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_percentage: '',
    original_price: '',
    offer_price: '',
    is_active: true,
    valid_from: new Date(),
    valid_until: undefined as Date | undefined
  });

  useEffect(() => {
    fetchOffers();
  }, [vendorId]);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_offers')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOffers(data?.map(offer => ({
        ...offer,
        valid_from: new Date(offer.valid_from),
        valid_until: offer.valid_until ? new Date(offer.valid_until) : undefined
      })) || []);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las ofertas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOffer = async () => {
    try {
      const offerData = {
        vendor_id: vendorId,
        title: formData.title,
        description: formData.description,
        discount_percentage: formData.discount_percentage ? parseInt(formData.discount_percentage) : null,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        offer_price: formData.offer_price ? parseFloat(formData.offer_price) : null,
        is_active: formData.is_active,
        valid_from: formData.valid_from.toISOString(),
        valid_until: formData.valid_until?.toISOString()
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('vendor_offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;
        toast({
          title: '✅ Oferta actualizada',
          description: 'La oferta se ha actualizado correctamente'
        });
      } else {
        const { error } = await supabase
          .from('vendor_offers')
          .insert(offerData);

        if (error) throw error;
        toast({
          title: '✅ Oferta creada',
          description: 'La nueva oferta se ha creado correctamente'
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchOffers();
    } catch (error) {
      console.error('Error saving offer:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la oferta',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta oferta?')) return;

    try {
      const { error } = await supabase
        .from('vendor_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '🗑️ Oferta eliminada',
        description: 'La oferta se ha eliminado correctamente'
      });
      fetchOffers();
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la oferta',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('vendor_offers')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: !currentStatus ? '✅ Oferta activada' : '⏸️ Oferta desactivada',
        description: `La oferta ha sido ${!currentStatus ? 'activada' : 'desactivada'}`
      });
      fetchOffers();
    } catch (error) {
      console.error('Error toggling offer:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de la oferta',
        variant: 'destructive'
      });
    }
  };

  const startEditOffer = (offer: VendorOffer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description,
      discount_percentage: offer.discount_percentage?.toString() || '',
      original_price: offer.original_price?.toString() || '',
      offer_price: offer.offer_price?.toString() || '',
      is_active: offer.is_active,
      valid_from: offer.valid_from,
      valid_until: offer.valid_until
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discount_percentage: '',
      original_price: '',
      offer_price: '',
      is_active: true,
      valid_from: new Date(),
      valid_until: undefined
    });
    setEditingOffer(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Ofertas y Promociones</h3>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Oferta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((offer) => (
          <Card key={offer.id} className={cn("relative", !offer.is_active && "opacity-60")}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{offer.title}</CardTitle>
                <Badge variant={offer.is_active ? "default" : "secondary"}>
                  {offer.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{offer.description}</p>
              
              {offer.discount_percentage && (
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">{offer.discount_percentage}% OFF</span>
                </div>
              )}
              
              {offer.original_price && offer.offer_price && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="line-through text-muted-foreground">${offer.original_price}</span>
                  <span className="font-bold text-primary">${offer.offer_price}</span>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  Desde: {format(offer.valid_from, 'dd/MM/yyyy', { locale: es })}
                </div>
                {offer.valid_until && (
                  <div className="flex items-center gap-1 mt-1">
                    <CalendarIcon className="h-3 w-3" />
                    Hasta: {format(offer.valid_until, 'dd/MM/yyyy', { locale: es })}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(offer.id, offer.is_active)}
                >
                  {offer.is_active ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditOffer(offer)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteOffer(offer.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {offers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay ofertas creadas</p>
            <p className="text-sm text-muted-foreground mt-2">
              Crea tu primera oferta para atraer más clientes
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingOffer ? 'Editar Oferta' : 'Nueva Oferta'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: 2x1 en pizzas familiares"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe tu oferta..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="discount">Descuento %</Label>
                <Input
                  id="discount"
                  type="number"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                  placeholder="20"
                />
              </div>
              
              <div>
                <Label htmlFor="original">Precio Original</Label>
                <Input
                  id="original"
                  type="number"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                  placeholder="100"
                />
              </div>
              
              <div>
                <Label htmlFor="offer">Precio Oferta</Label>
                <Input
                  id="offer"
                  type="number"
                  value={formData.offer_price}
                  onChange={(e) => setFormData({ ...formData, offer_price: e.target.value })}
                  placeholder="80"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Válido desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.valid_from, 'dd/MM/yyyy', { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.valid_from}
                      onSelect={(date) => date && setFormData({ ...formData, valid_from: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label>Válido hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.valid_until ? format(formData.valid_until, 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.valid_until}
                      onSelect={(date) => setFormData({ ...formData, valid_until: date || undefined })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active">Oferta activa</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOffer}>
              {editingOffer ? 'Actualizar' : 'Crear'} Oferta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}