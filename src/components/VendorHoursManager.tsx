import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, Plus, Trash2 } from 'lucide-react';

interface TimeSlot {
  id?: string;
  slot_number: number;
  opening_time: string;
  closing_time: string;
}

interface DayHours {
  day_of_week: string;
  is_closed: boolean;
  is_open_24_hours: boolean;
  time_slots: TimeSlot[];
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
  const [dayHours, setDayHours] = useState<DayHours[]>([]);
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
        .order('day_of_week')
        .order('slot_number');

      if (error) throw error;

      // Group hours by day
      const groupedHours: Record<string, any[]> = {};
      
      if (data && data.length > 0) {
        data.forEach(hour => {
          if (!groupedHours[hour.day_of_week]) {
            groupedHours[hour.day_of_week] = [];
          }
          groupedHours[hour.day_of_week].push(hour);
        });
      }

      // Create day hours structure
      const hours: DayHours[] = DAYS_OF_WEEK.map(day => {
        const dayData = groupedHours[day.value];
        
        if (dayData && dayData.length > 0) {
          const firstSlot = dayData[0];
          return {
            day_of_week: day.value,
            is_closed: firstSlot.is_closed,
            is_open_24_hours: firstSlot.is_open_24_hours,
            time_slots: dayData.map(slot => ({
              id: slot.id,
              slot_number: slot.slot_number,
              opening_time: slot.opening_time,
              closing_time: slot.closing_time
            }))
          };
        }
        
        // Default for days without data
        return {
          day_of_week: day.value,
          is_closed: false,
          is_open_24_hours: false,
          time_slots: [{
            slot_number: 1,
            opening_time: '09:00',
            closing_time: '21:00'
          }]
        };
      });

      setDayHours(hours);
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

      // Prepare hours to insert
      const hoursToInsert = dayHours.flatMap(day => 
        day.time_slots.map(slot => ({
          vendor_id: vendorId,
          day_of_week: day.day_of_week,
          slot_number: slot.slot_number,
          opening_time: slot.opening_time,
          closing_time: slot.closing_time,
          is_closed: day.is_closed,
          is_open_24_hours: day.is_open_24_hours
        }))
      );

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

  const updateDayField = (dayValue: string, field: 'is_closed' | 'is_open_24_hours', value: boolean) => {
    setDayHours(prev =>
      prev.map(day =>
        day.day_of_week === dayValue
          ? { ...day, [field]: value }
          : day
      )
    );
  };

  const updateTimeSlot = (dayValue: string, slotNumber: number, field: 'opening_time' | 'closing_time', value: string) => {
    setDayHours(prev =>
      prev.map(day =>
        day.day_of_week === dayValue
          ? {
              ...day,
              time_slots: day.time_slots.map(slot =>
                slot.slot_number === slotNumber
                  ? { ...slot, [field]: value }
                  : slot
              )
            }
          : day
      )
    );
  };

  const addTimeSlot = (dayValue: string) => {
    setDayHours(prev =>
      prev.map(day =>
        day.day_of_week === dayValue
          ? {
              ...day,
              time_slots: [
                ...day.time_slots,
                {
                  slot_number: day.time_slots.length + 1,
                  opening_time: '09:00',
                  closing_time: '21:00'
                }
              ]
            }
          : day
      )
    );
  };

  const removeTimeSlot = (dayValue: string, slotNumber: number) => {
    setDayHours(prev =>
      prev.map(day =>
        day.day_of_week === dayValue
          ? {
              ...day,
              time_slots: day.time_slots
                .filter(slot => slot.slot_number !== slotNumber)
                .map((slot, index) => ({ ...slot, slot_number: index + 1 }))
            }
          : day
      )
    );
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
          const dayData = dayHours.find(h => h.day_of_week === day.value) || {
            day_of_week: day.value,
            is_closed: false,
            is_open_24_hours: false,
            time_slots: [{ slot_number: 1, opening_time: '09:00', closing_time: '21:00' }]
          };

          return (
            <div key={day.value} className="space-y-3 p-4 bg-secondary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="font-medium">{day.label}</div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-24h`} className="text-sm">
                      24 horas
                    </Label>
                    <Switch
                      id={`${day.value}-24h`}
                      checked={dayData.is_open_24_hours}
                      onCheckedChange={(checked) => updateDayField(day.value, 'is_open_24_hours', checked)}
                      disabled={dayData.is_closed}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${day.value}-closed`} className="text-sm">
                      Cerrado
                    </Label>
                    <Switch
                      id={`${day.value}-closed`}
                      checked={dayData.is_closed}
                      onCheckedChange={(checked) => updateDayField(day.value, 'is_closed', checked)}
                    />
                  </div>
                </div>
              </div>
              
              {!dayData.is_closed && !dayData.is_open_24_hours && (
                <div className="space-y-2">
                  {dayData.time_slots.map((slot, index) => (
                    <div key={slot.slot_number} className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Abre:</Label>
                          <Input
                            type="time"
                            value={slot.opening_time}
                            onChange={(e) => updateTimeSlot(day.value, slot.slot_number, 'opening_time', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Cierra:</Label>
                          <Input
                            type="time"
                            value={slot.closing_time}
                            onChange={(e) => updateTimeSlot(day.value, slot.slot_number, 'closing_time', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      
                      {dayData.time_slots.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeTimeSlot(day.value, slot.slot_number)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addTimeSlot(day.value)}
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar horario cortado
                  </Button>
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