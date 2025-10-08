import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save } from 'lucide-react';

interface VendorHours {
  id?: string;
  day_of_week: string;
  opening_time: string;
  closing_time: string;
  is_closed: boolean;
  is_open_24_hours: boolean;
}

interface VendorHoursManagerProps {
  vendorId: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' }
];

export function VendorHoursManager({ vendorId }: VendorHoursManagerProps) {
  const [hours, setHours] = useState<VendorHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchHours();
  }, [vendorId]);

  const fetchHours = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_hours')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('day_of_week');

      if (error) throw error;

      // If no hours exist, create default hours
      if (!data || data.length === 0) {
        const defaultHours = DAYS_OF_WEEK.map(day => ({
          day_of_week: day.value,
          opening_time: '09:00',
          closing_time: '21:00',
          is_closed: false,
          is_open_24_hours: false
        }));
        setHours(defaultHours);
      } else {
        setHours(data);
      }
    } catch (error) {
      console.error('Error fetching hours:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los horarios',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async () => {
    setSaving(true);
    
    try {
      // Delete existing hours
      await supabase
        .from('vendor_hours')
        .delete()
        .eq('vendor_id', vendorId);

      // Insert new hours
      const hoursToInsert = hours.map(h => ({
        vendor_id: vendorId,
        day_of_week: h.day_of_week,
        opening_time: h.opening_time,
        closing_time: h.closing_time,
        is_closed: h.is_closed,
        is_open_24_hours: h.is_open_24_hours
      }));

      const { error } = await supabase
        .from('vendor_hours')
        .insert(hoursToInsert);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Horarios actualizados correctamente'
      });
    } catch (error) {
      console.error('Error saving hours:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los horarios',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (dayValue: string, field: keyof VendorHours, value: any) => {
    setHours(prevHours => 
      prevHours.map(h => 
        h.day_of_week === dayValue
          ? { ...h, [field]: value }
          : h
      )
    );
  };

  const applyToAll = (field: 'opening_time' | 'closing_time', sourceDay: string) => {
    const sourceHour = hours.find(h => h.day_of_week === sourceDay);
    if (sourceHour) {
      setHours(prevHours =>
        prevHours.map(h => ({
          ...h,
          [field]: sourceHour[field]
        }))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horarios de Atención
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const hourData = hours.find(h => h.day_of_week === day.value) || {
            day_of_week: day.value,
            opening_time: '09:00',
            closing_time: '21:00',
            is_closed: false,
            is_open_24_hours: false
          };

          return (
            <div key={day.value} className="space-y-2 p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="font-medium">{day.label}</div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-24h`} className="text-sm">
                      24 horas
                    </Label>
                    <Switch
                      id={`${day.value}-24h`}
                      checked={hourData.is_open_24_hours}
                      onCheckedChange={(checked) => updateHour(day.value, 'is_open_24_hours', checked)}
                      disabled={hourData.is_closed}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-closed`} className="text-sm">
                      Cerrado
                    </Label>
                    <Switch
                      id={`${day.value}-closed`}
                      checked={hourData.is_closed}
                      onCheckedChange={(checked) => updateHour(day.value, 'is_closed', checked)}
                    />
                  </div>
                </div>
              </div>
              
              {!hourData.is_closed && !hourData.is_open_24_hours && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-open`} className="text-xs">
                      Abre:
                    </Label>
                    <Input
                      id={`${day.value}-open`}
                      type="time"
                      value={hourData.opening_time}
                      onChange={(e) => updateHour(day.value, 'opening_time', e.target.value)}
                      className="w-full"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => applyToAll('opening_time', day.value)}
                      title="Aplicar a todos los días"
                      className="h-8 w-8"
                    >
                      ↓
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-close`} className="text-xs">
                      Cierra:
                    </Label>
                    <Input
                      id={`${day.value}-close`}
                      type="time"
                      value={hourData.closing_time}
                      onChange={(e) => updateHour(day.value, 'closing_time', e.target.value)}
                      className="w-full"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => applyToAll('closing_time', day.value)}
                      title="Aplicar a todos los días"
                      className="h-8 w-8"
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <Button 
          onClick={handleSaveHours} 
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
              Guardar Horarios
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}