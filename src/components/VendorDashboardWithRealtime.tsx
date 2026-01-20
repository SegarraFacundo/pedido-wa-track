import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderCard } from "@/components/OrderCard";
import { ChatInterface } from "@/components/ChatInterface";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { OrderStatus, Vendor } from "@/types/order";
import {
  Clock,
  Package,
  TrendingUp,
  DollarSign,
  MapPin,
  Phone,
  Calendar,
  Star,
  MessageCircle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ARGENTINA_TIMEZONE, getCurrentDayInArgentina } from "@/lib/timezone";

interface VendorDashboardWithRealtimeProps {
  vendor: Vendor;
}

export function VendorDashboardWithRealtime({ vendor }: VendorDashboardWithRealtimeProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderForChat, setSelectedOrderForChat] = useState<string | null>(null);
  const { orders, loading, updateOrderStatus } = useRealtimeOrders(vendor.id);
  const { toast } = useToast();

  // Today hours (from vendor_hours)
  const [todayHours, setTodayHours] = useState<Array<{ opening_time: string; closing_time: string; is_closed: boolean; is_open_24_hours: boolean }>>([]);
  const timeZone = ARGENTINA_TIMEZONE;

  useEffect(() => {
    const currentDay = getCurrentDayInArgentina();
    supabase
      .from('vendor_hours')
      .select('opening_time, closing_time, is_closed, is_open_24_hours')
      .eq('vendor_id', vendor.id)
      .eq('day_of_week', currentDay)
      .order('slot_number', { ascending: true })
      .then(({ data }) => setTodayHours(data || []));
  }, [vendor.id]);

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
      return orderDate.toDateString() === today.toDateString() && 
             o.status === 'delivered';
    })
    .reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      title: "Pedidos Activos",
      value: activeOrders.toString(),
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ingresos Hoy",
      value: `$${todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Pedidos",
      value: orders.length.toString(),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Calificación",
      value: vendor.rating.toFixed(1),
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
  ];

  const isOpen = () => {
    if (!todayHours || todayHours.length === 0) return false;
    
    // Check if any slot is open 24 hours
    if (todayHours.some(slot => slot.is_open_24_hours)) return true;
    
    // Check if all slots are closed
    if (todayHours.every(slot => slot.is_closed)) return false;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());

    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    const currentTime = `${hh}:${mm}`;

    // Check if current time is within any of the time slots
    return todayHours.some(slot => {
      if (slot.is_closed) return false;
      const openingTime = slot.opening_time.slice(0, 5);
      const closingTime = slot.closing_time.slice(0, 5);
      return currentTime >= openingTime && currentTime <= closingTime;
    });
  };

  const getHoursDisplay = () => {
    if (!todayHours || todayHours.length === 0) return 'Horario no configurado';
    if (todayHours.some(slot => slot.is_open_24_hours)) return '24 horas';
    if (todayHours.every(slot => slot.is_closed)) return 'Cerrado';
    
    const activeSlots = todayHours.filter(slot => !slot.is_closed);
    return activeSlots.map(slot => `${slot.opening_time.slice(0, 5)} - ${slot.closing_time.slice(0, 5)}`).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vendor Header */}
      <Card className="border-t-4 border-t-primary bg-gradient-to-br from-white to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{vendor.name}</h2>
                <Badge variant={isOpen() ? "default" : "secondary"} className="mt-2">
                  {isOpen() ? "Abierto" : todayHours.length > 0 ? "Cerrado" : "Sin horario"}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {vendor.address}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {vendor.phone}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {getHoursDisplay()}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Desde {vendor.joinedAt ? format(new Date(vendor.joinedAt), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                </div>
              </div>
            </div>
            
            <NotificationCenter vendorId={vendor.id} />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Gestión de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active" onClick={() => setStatusFilter('all')}>
                Activos ({orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length})
              </TabsTrigger>
              <TabsTrigger value="completed" onClick={() => setStatusFilter('delivered')}>
                Completados ({orders.filter(o => o.status === 'delivered').length})
              </TabsTrigger>
              <TabsTrigger value="all" onClick={() => setStatusFilter('all')}>
                Todos ({orders.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filteredOrders
                    .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateOrderStatus}
                        onOpenChat={setSelectedOrderForChat}
                        isVendorView={true}
                      />
                    ))}
                  {filteredOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay pedidos activos en este momento</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="completed" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filteredOrders
                    .filter(o => o.status === 'delivered')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateOrderStatus}
                        onOpenChat={setSelectedOrderForChat}
                        isVendorView={true}
                      />
                    ))}
                  {filteredOrders.filter(o => o.status === 'delivered').length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay pedidos completados</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="all" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filteredOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={updateOrderStatus}
                      onOpenChat={setSelectedOrderForChat}
                      isVendorView={true}
                    />
                  ))}
                  {filteredOrders.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay pedidos registrados</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Chat Modal */}
      {selectedOrderForChat && (
        <ChatModal
          orderId={selectedOrderForChat}
          vendorName={vendor.name}
          customerPhone={orders.find(o => o.id === selectedOrderForChat)?.customerPhone}
          onClose={() => setSelectedOrderForChat(null)}
        />
      )}
    </div>
  );
}

interface ChatModalProps {
  orderId: string;
  vendorName: string;
  customerPhone?: string;
  onClose: () => void;
}

function ChatModal({ orderId, vendorName, customerPhone, onClose }: ChatModalProps) {
  const { messages, sendMessage, isBotPaused, activateBot } = useRealtimeMessages(orderId, customerPhone);

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50 animate-slide-in">
      <div className="relative h-full">
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 z-10 bg-white rounded-full shadow-lg"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <ChatInterface
          orderId={orderId}
          messages={messages}
          onSendMessage={(content) => sendMessage(content, 'vendor')}
          vendorName={vendorName}
          customerName="Cliente"
          isVendorView={true}
          isBotPaused={isBotPaused}
          onActivateBot={activateBot}
        />
      </div>
    </div>
  );
}