import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, DollarSign, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface PaymentMetrics {
  pending: {
    count: number;
    total: number;
  };
  paid: {
    count: number;
    total: number;
  };
  failed: {
    count: number;
    total: number;
  };
  totalCollected: number;
  recentPayments: Array<{
    id: string;
    order_id: string;
    amount: number;
    status: string;
    payment_method_name: string;
    payment_date: string | null;
    created_at: string;
  }>;
}

interface VendorPaymentMetricsProps {
  vendorId: string;
}

export function VendorPaymentMetrics({ vendorId }: VendorPaymentMetricsProps) {
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    fetchMetrics();
  }, [vendorId, period]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Calcular rango de fechas según el período
      let dateFilter = null;
      if (period === '7d') {
        dateFilter = startOfDay(subDays(new Date(), 7)).toISOString();
      } else if (period === '30d') {
        dateFilter = startOfDay(subDays(new Date(), 30)).toISOString();
      }

      // Obtener todos los pagos del vendor
      let query = supabase
        .from('order_payments')
        .select(`
          *,
          orders!inner(vendor_id)
        `)
        .eq('orders.vendor_id', vendorId);

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: payments, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Calcular métricas
      const pending = payments?.filter(p => p.status === 'pending') || [];
      const paid = payments?.filter(p => p.status === 'paid') || [];
      const failed = payments?.filter(p => p.status === 'failed') || [];

      const metricsData: PaymentMetrics = {
        pending: {
          count: pending.length,
          total: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        paid: {
          count: paid.length,
          total: paid.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        failed: {
          count: failed.length,
          total: failed.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        totalCollected: paid.reduce((sum, p) => sum + Number(p.amount), 0),
        recentPayments: payments?.slice(0, 10) || [],
      };

      setMetrics(metricsData);
    } catch (error) {
      console.error('Error fetching payment metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Pagado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3" />
            Pendiente
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Fallido
          </span>
        );
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No se pudieron cargar las métricas de pagos
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex justify-end">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d' | 'all')} className="w-auto">
          <TabsList>
            <TabsTrigger value="7d">Últimos 7 días</TabsTrigger>
            <TabsTrigger value="30d">Últimos 30 días</TabsTrigger>
            <TabsTrigger value="all">Todo el tiempo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Cards de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recaudado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              $ {metrics.totalCollected.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.paid.count} pagos confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {metrics.pending.count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              $ {metrics.pending.total.toLocaleString('es-AR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Confirmados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics.paid.count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              $ {metrics.paid.total.toLocaleString('es-AR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Fallidos</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {metrics.failed.count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              $ {metrics.failed.total.toLocaleString('es-AR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de pagos recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay pagos registrados en este período
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        Pedido #{payment.order_id.substring(0, 8)}
                      </span>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>💳 {payment.payment_method_name}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(payment.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                      {payment.payment_date && (
                        <>
                          <span>•</span>
                          <span>
                            Pagado: {format(new Date(payment.payment_date), "d 'de' MMMM", { locale: es })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      $ {Number(payment.amount).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
