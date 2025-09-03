import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDashboard } from "@/components/VendorDashboard";
import { OrderTracking } from "@/components/OrderTracking";
import { ChatInterface } from "@/components/ChatInterface";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { mockOrders, mockVendors, mockMessages } from "@/data/mockData";
import { Order, OrderStatus, Vendor, Message } from "@/types/order";
import { MessageCircle, X, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [selectedOrderForChat, setSelectedOrderForChat] = useState<string | null>(null);
  const [selectedVendor] = useState<Vendor>(vendors[0]); // Simulating logged-in vendor
  const { toast } = useToast();

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly update an order's status
      if (Math.random() > 0.7) {
        setOrders(prevOrders => {
          const orderToUpdate = prevOrders.find(o => 
            o.status !== 'delivered' && o.status !== 'cancelled'
          );
          
          if (orderToUpdate) {
            const nextStatus = getNextStatus(orderToUpdate.status);
            if (nextStatus) {
              toast({
                title: "Estado actualizado",
                description: `Pedido #${orderToUpdate.id.slice(0, 8)} cambió a ${nextStatus}`,
              });
              
              return prevOrders.map(o => 
                o.id === orderToUpdate.id 
                  ? { ...o, status: nextStatus, updatedAt: new Date() }
                  : o
              );
            }
          }
          return prevOrders;
        });
      }
    }, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, [toast]);

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const flow: Record<OrderStatus, OrderStatus | null> = {
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'delivering',
      delivering: 'delivered',
      delivered: null,
      cancelled: null,
    };
    return flow[currentStatus];
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId
          ? { ...order, status: newStatus, updatedAt: new Date() }
          : order
      )
    );
    
    // Add system message
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      orderId,
      sender: 'system',
      content: `Estado del pedido actualizado a: ${newStatus}`,
      timestamp: new Date(),
      isRead: false
    };
    setMessages(prev => [...prev, newMessage]);
    
    toast({
      title: "Estado actualizado",
      description: `El pedido ha sido marcado como ${newStatus}`,
    });
  };

  const handleSendMessage = (orderId: string, content: string, sender: 'customer' | 'vendor') => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      orderId,
      sender,
      content,
      timestamp: new Date(),
      isRead: false
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleToggleVendorStatus = (vendorId: string) => {
    setVendors(prevVendors =>
      prevVendors.map(vendor =>
        vendor.id === vendorId
          ? { ...vendor, isActive: !vendor.isActive }
          : vendor
      )
    );
    
    const vendor = vendors.find(v => v.id === vendorId);
    toast({
      title: vendor?.isActive ? "Vendedor desactivado" : "Vendedor activado",
      description: `${vendor?.name} ha sido ${vendor?.isActive ? 'desactivado' : 'activado'}`,
    });
  };

  const vendorOrders = orders.filter(o => o.vendorId === selectedVendor.id);
  const selectedOrderMessages = selectedOrderForChat 
    ? messages.filter(m => m.orderId === selectedOrderForChat)
    : [];
  const selectedOrder = orders.find(o => o.id === selectedOrderForChat);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-hero rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                  DeliveryHub
                </h1>
                <p className="text-xs text-muted-foreground">Sistema de Gestión de Pedidos</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Conectado como: <span className="font-medium text-foreground">{selectedVendor.name}</span>
              </span>
              <div className="w-2 h-2 bg-status-ready rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="vendor" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="vendor">Panel Vendedor</TabsTrigger>
            <TabsTrigger value="tracking">Seguimiento</TabsTrigger>
            <TabsTrigger value="admin">Administración</TabsTrigger>
            <TabsTrigger value="about">Acerca de</TabsTrigger>
          </TabsList>

          <TabsContent value="vendor">
            <VendorDashboard
              vendor={selectedVendor}
              orders={vendorOrders}
              onStatusChange={handleStatusChange}
              onOpenChat={setSelectedOrderForChat}
            />
          </TabsContent>

          <TabsContent value="tracking">
            <div className="space-y-6">
              {orders.slice(0, 2).map(order => (
                <OrderTracking key={order.id} order={order} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="admin">
            <AdminPanel
              vendors={vendors}
              onToggleVendorStatus={handleToggleVendorStatus}
            />
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">
                Sistema de Delivery Unificado
              </h2>
              <p className="text-muted-foreground mb-8">
                Conectamos vendedores con clientes a través de WhatsApp Business, 
                facilitando pedidos y entregas en toda la ciudad.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <div className="text-3xl mb-3">🚀</div>
                  <h3 className="font-semibold mb-2">Rápido y Eficiente</h3>
                  <p className="text-sm text-muted-foreground">
                    Procesamiento instantáneo de pedidos con seguimiento en tiempo real
                  </p>
                </div>
                
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <div className="text-3xl mb-3">💬</div>
                  <h3 className="font-semibold mb-2">Chat Integrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Comunicación directa entre vendedores y clientes vía WhatsApp
                  </p>
                </div>
                
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <div className="text-3xl mb-3">📍</div>
                  <h3 className="font-semibold mb-2">Tracking GPS</h3>
                  <p className="text-sm text-muted-foreground">
                    Seguimiento en vivo de todos los pedidos en entrega
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Chat Window */}
      {selectedOrderForChat && selectedOrder && (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50 animate-slide-in">
          <div className="relative h-full">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 z-10 bg-white rounded-full shadow-lg"
              onClick={() => setSelectedOrderForChat(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <ChatInterface
              orderId={selectedOrderForChat}
              messages={selectedOrderMessages}
              onSendMessage={(content) => handleSendMessage(selectedOrderForChat, content, 'vendor')}
              vendorName={selectedVendor.name}
              customerName={selectedOrder.customerName}
              isVendorView={true}
            />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {!selectedOrderForChat && (
        <Button
          className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg bg-gradient-primary hover:opacity-90"
          onClick={() => vendorOrders[0] && setSelectedOrderForChat(vendorOrders[0].id)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default Index;
