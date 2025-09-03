import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDashboard } from "@/components/VendorDashboard";
import { VendorCatalog } from "@/components/VendorCatalog";
import { OrderTracking } from "@/components/OrderTracking";
import { ChatInterface } from "@/components/ChatInterface";
import { AdminPanel } from "@/components/AdminPanel";
import { TwilioConfig } from "@/components/TwilioConfig";
import { Button } from "@/components/ui/button";
import { mockOrders, mockVendors, mockMessages } from "@/data/mockData";
import { Order, OrderStatus, Vendor, Message } from "@/types/order";
import { MessageCircle, X, ShoppingBag, Bot, TreePine } from "lucide-react";
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
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Lapacho
                </h1>
                <p className="text-xs text-muted-foreground">Plataforma de Delivery Local</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Tu delivery de confianza
              </span>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="catalog">Catálogo</TabsTrigger>
            <TabsTrigger value="vendor">Panel Vendedor</TabsTrigger>
            <TabsTrigger value="tracking">Seguimiento</TabsTrigger>
            <TabsTrigger value="admin">Administración</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Bot</TabsTrigger>
            <TabsTrigger value="about">Acerca de</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <VendorCatalog />
          </TabsContent>

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

          <TabsContent value="whatsapp">
            <TwilioConfig />
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <div className="text-center max-w-3xl mx-auto">
              <div className="mb-8">
                <TreePine className="h-16 w-16 text-primary mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                  Lapacho - Tu Delivery Local
                </h2>
                <p className="text-muted-foreground mb-4">
                  Inspirado en el árbol Lapacho rosa, símbolo de belleza y fortaleza en nuestra región.
                </p>
                <p className="text-muted-foreground">
                  Conectamos vendedores locales con clientes a través de WhatsApp Business, 
                  facilitando pedidos y entregas en toda la ciudad de manera simple y eficiente.
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="bg-card p-6 rounded-lg shadow-sm border-t-4 border-primary">
                  <div className="text-3xl mb-3">🛵</div>
                  <h3 className="font-semibold mb-2">Delivery Rápido</h3>
                  <p className="text-sm text-muted-foreground">
                    Procesamiento instantáneo de pedidos con tiempos de entrega de 30-45 minutos
                  </p>
                </div>
                
                <div className="bg-card p-6 rounded-lg shadow-sm border-t-4 border-primary">
                  <div className="text-3xl mb-3">💬</div>
                  <h3 className="font-semibold mb-2">WhatsApp Business</h3>
                  <p className="text-sm text-muted-foreground">
                    Bot inteligente que entiende tus pedidos y te conecta con los mejores locales
                  </p>
                </div>
                
                <div className="bg-card p-6 rounded-lg shadow-sm border-t-4 border-primary">
                  <div className="text-3xl mb-3">🏪</div>
                  <h3 className="font-semibold mb-2">Locales Verificados</h3>
                  <p className="text-sm text-muted-foreground">
                    Restaurantes, farmacias y mercados con productos actualizados y precios reales
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
