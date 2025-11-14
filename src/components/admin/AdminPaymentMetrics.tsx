import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, DollarSign, Users, Clock } from "lucide-react";
import { toast } from "sonner";

interface PaymentMetrics {
  totalPending: number;
  totalCollected: number;
  totalHistorical: number;
  averageCommissionPerVendor: number;
  vendorsWithPending: number;
  totalVendors: number;
  recentInvoices: Invoice[];
}

interface Invoice {
  id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  generated_at: string;
  paid_at: string | null;
}

export default function AdminPaymentMetrics() {
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      let startDate = new Date();
      if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate = new Date(0); // All time
      }

      // Fetch commissions
      const startDateStr = startDate.toISOString();
      const { data: commissions, error: commissionsError } = await supabase
        .from('vendor_commissions')
        .select('*')
        .gte('created_at', startDateStr);

      if (commissionsError) throw commissionsError;

      // Fetch invoices with vendor names
      const { data: invoices, error: invoicesError } = await supabase
        .from('commission_invoices')
        .select(`
          *,
          vendors (name)
        `)
        .gte('generated_at', startDateStr)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (invoicesError) throw invoicesError;

      // Calculate metrics
      const totalPending = commissions
        ?.filter((c) => c.status === 'pending' || c.status === 'invoiced')
        .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0;

      const totalCollected = commissions
        ?.filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0;

      // Fetch total historical (all time)
      const { data: allCommissions } = await supabase
        .from('vendor_commissions')
        .select('commission_amount')
        .eq('status', 'paid');

      const totalHistorical = allCommissions
        ?.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0;

      // Get unique vendors with pending commissions
      const vendorsWithPending = new Set(
        commissions
          ?.filter((c) => c.status === 'pending' || c.status === 'invoiced')
          .map((c) => c.vendor_id)
      ).size;

      // Get total active vendors
      const { count: totalVendors } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const averageCommissionPerVendor = 
        totalVendors && totalVendors > 0 ? totalPending / totalVendors : 0;

      const formattedInvoices: Invoice[] = invoices?.map((inv: any) => ({
        id: inv.id,
        vendor_id: inv.vendor_id,
        vendor_name: inv.vendors?.name || 'Desconocido',
        invoice_number: inv.invoice_number,
        period_start: inv.period_start,
        period_end: inv.period_end,
        total_amount: parseFloat(inv.total_amount || '0'),
        status: inv.status,
        generated_at: inv.generated_at,
        paid_at: inv.paid_at
      })) || [];

      setMetrics({
        totalPending,
        totalCollected,
        totalHistorical,
        averageCommissionPerVendor,
        vendorsWithPending,
        totalVendors: totalVendors || 0,
        recentInvoices: formattedInvoices
      });
    } catch (error) {
      console.error('Error fetching payment metrics:', error);
      toast.error('Error al cargar métricas de pagos');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "outline", label: "Pendiente" },
      paid: { variant: "default", label: "Pagado" },
      cancelled: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se pudieron cargar las métricas
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="7d">Últimos 7 días</TabsTrigger>
          <TabsTrigger value="30d">Últimos 30 días</TabsTrigger>
          <TabsTrigger value="all">Todo el tiempo</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalPending)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.vendorsWithPending} vendors con pagos pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado en Período</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalCollected)}</div>
            <p className="text-xs text-muted-foreground">
              En el período seleccionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Histórico</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalHistorical)}</div>
            <p className="text-xs text-muted-foreground">
              Desde el inicio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Vendor</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.averageCommissionPerVendor)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalVendors} vendors activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay facturas generadas aún
            </p>
          ) : (
            <div className="space-y-4">
              {metrics.recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{invoice.vendor_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.invoice_number} • {new Date(invoice.period_start).toLocaleDateString('es-PY')} - {new Date(invoice.period_end).toLocaleDateString('es-PY')}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(invoice.total_amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(invoice.generated_at).toLocaleDateString('es-PY')}
                      </div>
                    </div>
                    {getStatusBadge(invoice.status)}
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
