import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';

interface OrderCancellationDialogProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isVendor?: boolean;
}

export function OrderCancellationDialog({
  orderId,
  isOpen,
  onClose,
  onSuccess,
  isVendor = false
}: OrderCancellationDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleCancel = async () => {
    if (reason.trim().length < 10) {
      toast({
        title: 'Error',
        description: 'El motivo debe tener al menos 10 caracteres',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Record in history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: 'cancelled',
          changed_by: isVendor ? 'vendor' : 'customer',
          reason: reason.trim()
        });

      if (historyError) throw historyError;

      toast({
        title: 'Pedido cancelado',
        description: 'El pedido ha sido cancelado exitosamente'
      });

      onSuccess();
      onClose();
      setReason('');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cancelar el pedido',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Cancelar Pedido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Por favor proporciona un motivo detallado para la cancelación del pedido.
            Esta información es importante para mejorar nuestro servicio.
          </p>
          <div>
            <label className="text-sm font-medium">Motivo de cancelación *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente solicitó cambio de dirección, producto agotado, error en el pedido..."
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mínimo 10 caracteres
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="destructive"
              disabled={isSubmitting || reason.trim().length < 10}
              className="flex-1"
            >
              {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelación'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Volver
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
