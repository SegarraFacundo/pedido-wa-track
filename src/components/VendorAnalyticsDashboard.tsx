import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Package, Clock, DollarSign, ShoppingCart, Star } from 'lucide-react';
import { format, subDays, startOfDay, parseISO, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface VendorAnalyticsDashboardProps {
  vendorId: string;
}

interface DailySale {
  date: string;
  dateLabel: string;
  total: number;
  orders: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface PeakHour {
  hour: string;
  hourNum: number;
  orders: number;
}

interface OrderItem {
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity: number;
  price: number;
}

export function VendorAnalyticsDashboard({ vendorId }: VendorAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgTicket: 0,
    peakHour: '',
    topProduct: '',
  });

  useEffect(() => {
    fetchAnalytics();
  }, [vendorId, period]);

  const getDateFilter = () => {
    const now = new Date();
    switch (period) {
      case '7d':
        return subDays(now, 7).toISOString();
      case '30d':
        return subDays(now, 30).toISOString();
      default:
        return null;
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();
      
      let query = supabase
        .from('orders')
        .select('total, created_at, items, status')
        .eq('vendor_id', vendorId)
        .in('status', ['delivered', 'confirmed', 'preparing', 'ready', 'delivering']);

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error('Error fetching analytics:', error);
        return;
      }

      if (!orders || orders.length === 0) {
        setDailySales([]);
        setTopProducts([]);
        setPeakHours([]);
        setSummary({
          totalRevenue: 0,
          totalOrders: 0,
          avgTicket: 0,
          peakHour: '',
          topProduct: '',
        });
        setLoading(false);
        return;
      }

      // Process daily sales
      const salesByDay = new Map<string, { total: number; orders: number }>();
      const productSales = new Map<string, { quantity: number; revenue: number }>();
      const hourCounts = new Map<number, number>();

      orders.forEach((order) => {
        // Daily sales
        const date = startOfDay(parseISO(order.created_at)).toISOString();
        const existing = salesByDay.get(date) || { total: 0, orders: 0 };
        salesByDay.set(date, {
          total: existing.total + order.total,
          orders: existing.orders + 1,
        });

        // Peak hours
        const hour = getHours(parseISO(order.created_at));
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

        // Top products
        const items = order.items as unknown as OrderItem[];
        if (Array.isArray(items)) {
          items.forEach((item) => {
            const productName = item.product_name || item.name || 'Producto';
            const existing = productSales.get(productName) || { quantity: 0, revenue: 0 };
            productSales.set(productName, {
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + item.price * item.quantity,
            });
          });
        }
      });

      // Format daily sales
      const dailySalesArray: DailySale[] = Array.from(salesByDay.entries())
        .map(([date, data]) => ({
          date,
          dateLabel: format(parseISO(date), 'dd MMM', { locale: es }),
          total: data.total,
          orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Format top products (top 8)
      const topProductsArray: TopProduct[] = Array.from(productSales.entries())
        .map(([name, data]) => ({
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          quantity: data.quantity,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8);

      // Format peak hours (8:00 - 23:00)
      const peakHoursArray: PeakHour[] = [];
      for (let h = 8; h <= 23; h++) {
        peakHoursArray.push({
          hour: `${h}:00`,
          hourNum: h,
          orders: hourCounts.get(h) || 0,
        });
      }

      // Calculate summary
      const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      const totalOrders = orders.length;
      const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      let maxHour = 0;
      let maxHourCount = 0;
      hourCounts.forEach((count, hour) => {
        if (count > maxHourCount) {
          maxHourCount = count;
          maxHour = hour;
        }
      });

      setDailySales(dailySalesArray);
      setTopProducts(topProductsArray);
      setPeakHours(peakHoursArray);
      setSummary({
        totalRevenue,
        totalOrders,
        avgTicket,
        peakHour: maxHourCount > 0 ? `${maxHour}:00` : 'N/A',
        topProduct: topProductsArray[0]?.name || 'N/A',
      });
    } catch (error) {
      console.error('Error in fetchAnalytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    total: {
      label: 'Ventas',
      color: 'hsl(var(--primary))',
    },
    orders: {
      label: 'Pedidos',
      color: 'hsl(var(--chart-2))',
    },
    quantity: {
      label: 'Cantidad',
      color: 'hsl(var(--chart-3))',
    },
  };

  const maxOrders = useMemo(() => {
    return Math.max(...peakHours.map(h => h.orders), 1);
  }, [peakHours]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = summary.totalOrders > 0;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics de Ventas</h2>
          <p className="text-muted-foreground">Estadísticas de tu negocio</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value="7d">7 días</TabsTrigger>
            <TabsTrigger value="30d">30 días</TabsTrigger>
            <TabsTrigger value="all">Todo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Ingresos</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ₲{summary.totalRevenue.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-chart-2" />
              <span className="text-sm text-muted-foreground">Pedidos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-3" />
              <span className="text-sm text-muted-foreground">Ticket Prom.</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ₲{Math.round(summary.avgTicket).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-chart-4" />
              <span className="text-sm text-muted-foreground">Hora Pico</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.peakHour}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-chart-5" />
              <span className="text-sm text-muted-foreground">Top Producto</span>
            </div>
            <p className="text-lg font-bold mt-1 truncate" title={summary.topProduct}>
              {summary.topProduct}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin datos suficientes</h3>
            <p className="text-muted-foreground">
              Aún no hay pedidos en este período para mostrar estadísticas
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Daily Sales Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Ventas Diarias
              </CardTitle>
              <CardDescription>
                Ingresos y cantidad de pedidos por día
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={dailySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₲${(value / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => {
                          if (name === 'total') return [`₲${Number(value).toLocaleString()}`, 'Ventas'];
                          return [value, 'Pedidos'];
                        }}
                      />
                    } 
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Two column layout for smaller charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-chart-3" />
                  Productos Más Vendidos
                </CardTitle>
                <CardDescription>
                  Top 8 productos por cantidad vendida
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart 
                      data={topProducts} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        tick={{ fontSize: 11 }}
                        width={100}
                        tickLine={false}
                      />
                      <ChartTooltip 
                        content={
                          <ChartTooltipContent 
                            formatter={(value, name, item) => {
                              const payload = item.payload as TopProduct;
                              return [
                                <div key="tooltip" className="flex flex-col gap-1">
                                  <span>Cantidad: {payload.quantity}</span>
                                  <span>Ingresos: ₲{payload.revenue.toLocaleString()}</span>
                                </div>,
                                ''
                              ];
                            }}
                          />
                        }
                      />
                      <Bar 
                        dataKey="quantity" 
                        fill="hsl(var(--chart-3))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos de productos
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-chart-4" />
                  Horarios Pico
                </CardTitle>
                <CardDescription>
                  Distribución de pedidos por hora del día
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={peakHours} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value) => [`${value} pedidos`, '']}
                        />
                      }
                    />
                    <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                      {peakHours.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={entry.orders === maxOrders && entry.orders > 0
                            ? 'hsl(var(--chart-1))'
                            : 'hsl(var(--chart-4))'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
