import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderCard } from "@/components/OrderCard";
import { Order, OrderStatus, Vendor } from "@/types/order";
import { DollarSign, Package, TrendingUp, Users, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorDashboardProps {
  vendor: Vendor;
  orders: Order[];
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onOpenChat: (orderId: string) => void;
}

export function VendorDashboard({ vendor, orders, onStatusChange, onOpenChat }: VendorDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);
  
  const activeOrders = orders.filter(o => 
    o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;
  
  const todayRevenue = orders
    .filter(o => {
      const today = new Date();
      const orderDate = new Date(o.createdAt);
      return orderDate.toDateString() === today.toDateString() && o.status === 'delivered';
    })
    .reduce((sum, o) => sum + o.total, 0);
  
  const stats = [
    {
      title: "Pedidos Activos",
      value: activeOrders,
      icon: Package,
      className: "text-status-confirmed"
    },
    {
      title: "Ingresos Hoy",
      value: `$${todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      className: "text-status-ready"
    },
    {
      title: "Total Pedidos",
      value: vendor.totalOrders,
      icon: TrendingUp,
      className: "text-status-delivering"
    },
    {
      title: "Calificación",
      value: `⭐ ${vendor.rating.toFixed(1)}`,
      icon: Users,
      className: "text-status-pending"
    }
  ];
  
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.className}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Gestión de Pedidos</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="confirmed">Confirmados</SelectItem>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="ready">Listos</SelectItem>
                  <SelectItem value="delivering">En camino</SelectItem>
                  <SelectItem value="delivered">Entregados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Activos</TabsTrigger>
              <TabsTrigger value="completed">Completados</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              {filteredOrders
                .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={onStatusChange}
                    onOpenChat={onOpenChat}
                    isVendorView
                  />
                ))}
              {filteredOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay pedidos activos</p>
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-4">
              {filteredOrders
                .filter(o => o.status === 'delivered')
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={onStatusChange}
                    onOpenChat={onOpenChat}
                    isVendorView
                  />
                ))}
              {filteredOrders.filter(o => o.status === 'delivered').length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay pedidos completados</p>
              )}
            </TabsContent>
            
            <TabsContent value="all" className="space-y-4">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={onStatusChange}
                  onOpenChat={onOpenChat}
                  isVendorView
                />
              ))}
              {filteredOrders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay pedidos</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}