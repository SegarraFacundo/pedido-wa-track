import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDashboardWithRealtime } from "@/components/VendorDashboardWithRealtime";
import { VendorCatalog } from "@/components/VendorCatalog";
import { OrderTracking } from "@/components/OrderTracking";
import { AdminPanel } from "@/components/AdminPanel";
import { TwilioConfig } from "@/components/TwilioConfig";
import { Vendor } from "@/types/order";
import { TreePine, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";

const Index = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const { toast } = useToast();
  const { orders } = useRealtimeOrders();

  // Fetch vendors from Supabase
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        const formattedVendors: Vendor[] = data?.map((vendor: any) => ({
          id: vendor.id,
          name: vendor.name,
          category: vendor.category,
          phone: vendor.phone,
          whatsappNumber: vendor.whatsapp_number,
          address: vendor.address,
          isActive: vendor.is_active,
          rating: Number(vendor.rating),
          totalOrders: vendor.total_orders,
          joinedAt: new Date(vendor.joined_at),
          image: vendor.image,
          openingTime: vendor.opening_time,
          closingTime: vendor.closing_time,
          daysOpen: vendor.days_open,
          availableProducts: vendor.available_products
        })) || [];

        setVendors(formattedVendors);
        if (formattedVendors.length > 0) {
          setSelectedVendor(formattedVendors[0]);
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los vendedores',
          variant: 'destructive'
        });
      } finally {
        setLoadingVendors(false);
      }
    };

    fetchVendors();
  }, [toast]);

  const handleToggleVendorStatus = async (vendorId: string) => {
    try {
      const vendor = vendors.find(v => v.id === vendorId);
      const newStatus = !vendor?.isActive;

      const { error } = await supabase
        .from('vendors')
        .update({ is_active: newStatus })
        .eq('id', vendorId);

      if (error) throw error;

      setVendors(prevVendors =>
        prevVendors.map(vendor =>
          vendor.id === vendorId
            ? { ...vendor, isActive: newStatus }
            : vendor
        )
      );
      
      toast({
        title: newStatus ? "Vendedor activado" : "Vendedor desactivado",
        description: `${vendor?.name} ha sido ${newStatus ? 'activado' : 'desactivado'}`,
      });
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del vendedor',
        variant: 'destructive'
      });
    }
  };

  if (loadingVendors) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              <a 
                href="/vendor-auth"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Store className="h-4 w-4" />
                Acceso Vendedores
              </a>
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
            {selectedVendor && (
              <VendorDashboardWithRealtime vendor={selectedVendor} />
            )}
          </TabsContent>

          <TabsContent value="tracking">
            <div className="space-y-6">
              {orders.slice(0, 5).map(order => (
                <OrderTracking key={order.id} order={order} />
              ))}
              {orders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No hay pedidos para rastrear</p>
                </div>
              )}
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
    </div>
  );
};

export default Index;