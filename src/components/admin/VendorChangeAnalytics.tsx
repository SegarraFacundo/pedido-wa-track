import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingDown, TrendingUp, Users, ShoppingCart } from "lucide-react";

interface VendorChangeMetric {
  date: string;
  action: string;
  total_events: number;
  avg_cart_items: number;
  avg_cart_value: number;
  avg_decision_time_seconds: number;
  unique_users: number;
}

interface VendorChangeSummary {
  vendor_id: string;
  vendor_name: string;
  category: string;
  retained_customers: number;
  lost_customers: number;
  acquired_customers: number;
  net_customer_change: number;
}

export function VendorChangeAnalytics() {
  // Fetch daily metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['vendor-change-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_change_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as VendorChangeMetric[];
    }
  });

  // Fetch vendor summary
  const { data: vendorSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['vendor-change-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_change_summary')
        .select('*')
        .order('net_customer_change', { ascending: false });
      
      if (error) throw error;
      return data as VendorChangeSummary[];
    }
  });

  // Calculate aggregate stats
  const stats = metrics?.reduce((acc, m) => {
    if (m.action === 'confirmed') {
      acc.totalConfirmed += m.total_events;
    } else {
      acc.totalCancelled += m.total_events;
    }
    acc.totalEvents += m.total_events;
    return acc;
  }, { totalConfirmed: 0, totalCancelled: 0, totalEvents: 0 });

  const confirmationRate = stats ? (stats.totalConfirmed / stats.totalEvents * 100).toFixed(1) : 0;
  const cancellationRate = stats ? (stats.totalCancelled / stats.totalEvents * 100).toFixed(1) : 0;

  // Prepare chart data
  const chartData = metrics?.slice(0, 7).reverse().map(m => ({
    date: new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
    Confirmados: m.action === 'confirmed' ? m.total_events : 0,
    Cancelados: m.action === 'cancelled' ? m.total_events : 0,
  })) || [];

  const pieData = [
    { name: 'Confirmados', value: stats?.totalConfirmed || 0 },
    { name: 'Cancelados', value: stats?.totalCancelled || 0 },
  ];

  const COLORS = ['#10b981', '#ef4444'];

  if (metricsLoading || summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics de Cambio de Negocio</h2>
        <p className="text-muted-foreground">
          Métricas sobre decisiones de usuarios al intentar cambiar de negocio con carrito activo
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Confirmación</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{confirmationRate}%</div>
            <p className="text-xs text-muted-foreground">{stats?.totalConfirmed} confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Cancelación</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancellationRate}%</div>
            <p className="text-xs text-muted-foreground">{stats?.totalCancelled} cancelados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio Carrito</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(metrics?.reduce((sum, m) => sum + m.avg_cart_value, 0) / (metrics?.length || 1)).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(metrics?.reduce((sum, m) => sum + m.avg_cart_items, 0) / (metrics?.length || 1)).toFixed(1)} items promedio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia Últimos 7 Días</CardTitle>
            <CardDescription>Confirmaciones vs Cancelaciones por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Confirmados" fill="#10b981" />
                <Bar dataKey="Cancelados" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución Total</CardTitle>
            <CardDescription>Proporción de confirmaciones vs cancelaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value} (${((entry.value / (stats?.totalEvents || 1)) * 100).toFixed(1)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen por Negocio</CardTitle>
          <CardDescription>
            Clientes retenidos, perdidos y adquiridos por cada negocio (últimos 30 días)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendorSummary && vendorSummary.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Retenidos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Adquiridos</TableHead>
                  <TableHead className="text-right">Cambio Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorSummary.map((vendor) => (
                  <TableRow key={vendor.vendor_id}>
                    <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                    <TableCell className="capitalize">{vendor.category}</TableCell>
                    <TableCell className="text-right text-green-600">{vendor.retained_customers}</TableCell>
                    <TableCell className="text-right text-red-600">{vendor.lost_customers}</TableCell>
                    <TableCell className="text-right text-blue-600">{vendor.acquired_customers}</TableCell>
                    <TableCell className={`text-right font-bold ${
                      vendor.net_customer_change > 0 
                        ? 'text-green-600' 
                        : vendor.net_customer_change < 0 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                    }`}>
                      {vendor.net_customer_change > 0 ? '+' : ''}{vendor.net_customer_change}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertDescription>
                No hay datos disponibles todavía. Los datos aparecerán cuando los usuarios empiecen a interactuar con el sistema de cambio de negocio.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Alta tasa de cancelación:</strong> Si más del 60% cancela, considera mejorar la experiencia del negocio actual o el menú del nuevo.
          </p>
          <p>
            <strong>Negocios con alto "Cambio Neto" positivo:</strong> Están atrayendo clientes de la competencia. Investiga qué hacen bien.
          </p>
          <p>
            <strong>Negocios con alto "Cambio Neto" negativo:</strong> Están perdiendo clientes. Pueden necesitar mejorar su oferta o servicio.
          </p>
          <p>
            <strong>Valor promedio de carrito:</strong> Si es alto cuando cancelan, significa que los usuarios tienen mucho en juego antes de decidir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}