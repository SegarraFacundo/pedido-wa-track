import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  FileText,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPaymentMethodIcon, isAutomaticPaymentMethod } from '@/lib/paymentValidation';

interface Payment {
  id: string;
  order_id: string;
  payment_method_name: string;
  amount: number;
  status: string;
  transaction_reference?: string;
  payment_date?: Date;
  notes?: string;
  created_at: Date;
}

interface PaymentManagerProps {
  orderId: string;
  vendorId: string;
  totalAmount: number;
  currentPaymentStatus?: string;
  onPaymentUpdate?: () => void;
}

export function PaymentManager({ 
  orderId, 
  vendorId, 
  totalAmount,
  currentPaymentStatus,
  onPaymentUpdate 
}: PaymentManagerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  const [paymentForm, setPaymentForm] = useState({
    status: 'completed',
    notes: '',
    transaction_reference: ''
  });

  useEffect(() => {
    fetchPayments();
  }, [orderId]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayments(data?.map(p => ({
        ...p,
        payment_date: p.payment_date ? new Date(p.payment_date) : undefined,
        created_at: new Date(p.created_at)
      })) || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pagos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmingPayment) return;

    try {
      const updateData: any = {
        status: paymentForm.status,
        notes: paymentForm.notes || null,
        transaction_reference: paymentForm.transaction_reference || confirmingPayment.transaction_reference
      };

      if (paymentForm.status === 'completed') {
        updateData.payment_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('order_payments')
        .update(updateData)
        .eq('id', confirmingPayment.id);

      if (error) throw error;

      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: paymentForm.status === 'completed' ? 'paid' : paymentForm.status,
          paid_at: paymentForm.status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      // Record in history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: paymentForm.status === 'completed' ? 'payment_confirmed' : 'payment_' + paymentForm.status,
          changed_by: 'vendor',
          reason: paymentForm.notes || `Pago ${paymentForm.status}`
        });

      toast({
        title: '✅ Pago actualizado',
        description: paymentForm.status === 'completed' 
          ? 'El pago ha sido confirmado' 
          : 'El estado del pago ha sido actualizado'
      });

      setDialogOpen(false);
      setConfirmingPayment(null);
      fetchPayments();
      onPaymentUpdate?.();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el pago',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'refunded':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      'pending': 'secondary',
      'processing': 'default',
      'completed': 'success',
      'failed': 'destructive',
      'refunded': 'outline'
    };
    
    const labels: any = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'completed': 'Completado',
      'failed': 'Fallido',
      'refunded': 'Reembolsado'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentPayment = payments[0];
  const hasPayment = payments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Información de Pago
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasPayment ? (
          <div className="space-y-4">
            {/* Current payment info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">Método de pago:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span>{getPaymentMethodIcon(currentPayment.payment_method_name)}</span>
                    {currentPayment.payment_method_name}
                  </Badge>
                  {isAutomaticPaymentMethod(currentPayment.payment_method_name.toLowerCase()) && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Automático
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monto:</span>
                <span className="font-bold text-lg">S/ {currentPayment.amount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estado:</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(currentPayment.status)}
                  {getStatusBadge(currentPayment.status)}
                </div>
              </div>

              {currentPayment.transaction_reference && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Referencia:</span>
                  <span className="font-mono text-sm">{currentPayment.transaction_reference}</span>
                </div>
              )}

              {currentPayment.payment_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fecha de pago:</span>
                  <span className="text-sm">
                    {format(currentPayment.payment_date, "d 'de' MMMM, HH:mm", { locale: es })}
                  </span>
                </div>
              )}

              {currentPayment.notes && (
                <div className="pt-2 border-t">
                  <span className="text-sm font-medium">Notas:</span>
                  <p className="text-sm text-muted-foreground mt-1">{currentPayment.notes}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {currentPayment.status !== 'completed' && currentPayment.status !== 'refunded' && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setConfirmingPayment(currentPayment);
                    setPaymentForm({
                      status: 'completed',
                      notes: '',
                      transaction_reference: currentPayment.transaction_reference || ''
                    });
                    setDialogOpen(true);
                  }}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Pago
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmingPayment(currentPayment);
                    setPaymentForm({
                      status: 'failed',
                      notes: '',
                      transaction_reference: currentPayment.transaction_reference || ''
                    });
                    setDialogOpen(true);
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Marcar como Fallido
                </Button>
              </div>
            )}

            {/* Payment history */}
            {payments.length > 1 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Historial de pagos</h4>
                <div className="space-y-2">
                  {payments.slice(1).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(payment.created_at, 'dd/MM HH:mm')}
                      </span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        <span>{payment.payment_method_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay información de pago</p>
            <p className="text-sm text-muted-foreground mt-2">
              El cliente aún no ha seleccionado un método de pago
            </p>
          </div>
        )}
      </CardContent>

      {/* Confirm payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentForm.status === 'completed' ? 'Confirmar Pago' : 'Actualizar Estado de Pago'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Estado del pago</Label>
              <Select 
                value={paymentForm.status} 
                onValueChange={(value) => setPaymentForm({...paymentForm, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="failed">Fallido</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {paymentForm.status === 'completed' && (
              <div>
                <Label htmlFor="reference">Referencia de transacción (opcional)</Label>
                <Input
                  id="reference"
                  value={paymentForm.transaction_reference}
                  onChange={(e) => setPaymentForm({...paymentForm, transaction_reference: e.target.value})}
                  placeholder="Ej: TRX123456"
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                placeholder="Agregar notas sobre el pago..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment}>
              Actualizar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}