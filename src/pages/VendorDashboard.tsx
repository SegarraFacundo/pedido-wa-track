import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { VendorDashboardWithRealtime } from '@/components/VendorDashboardWithRealtime';
import { VendorProductManager } from '@/components/VendorProductManager';
import { VendorHoursManager } from '@/components/VendorHoursManager';
import { VendorSettings } from '@/components/VendorSettings';
import { VendorOffersManager } from '@/components/VendorOffersManager';
import { VendorReviews } from '@/components/VendorReviews';
import { VendorDirectChat } from '@/components/VendorDirectChat';
import { VendorSupportTickets } from '@/components/VendorSupportTickets';
import { VendorPaymentSettings } from '@/components/VendorPaymentSettings';
import { VendorPaymentMetrics } from '@/components/VendorPaymentMetrics';
import { VendorAnalyticsDashboard } from '@/components/VendorAnalyticsDashboard';
import { PlatformReviewForm } from '@/components/PlatformReviewForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Package, Clock, Settings, LayoutDashboard, Tag, Star, 
  MessageCircle, LifeBuoy, CreditCard, Heart, BarChart3, Menu, LogOut 
} from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import lapachoIcon from "@/assets/lapacho-icon.png";
import { cn } from "@/lib/utils";

const menuItems = [
  { value: "dashboard", label: "Pedidos", icon: LayoutDashboard },
  { value: "products", label: "Productos", icon: Package },
  { value: "offers", label: "Ofertas", icon: Tag },
  { value: "chats", label: "Chats", icon: MessageCircle },
  { value: "reviews", label: "Reseñas", icon: Star },
  { value: "hours", label: "Horarios", icon: Clock },
  { value: "metrics", label: "Métricas", icon: BarChart3 },
  { value: "payments", label: "Pagos", icon: CreditCard },
  { value: "settings", label: "Ajustes", icon: Settings },
  { value: "support", label: "Soporte", icon: LifeBuoy },
  { value: "review", label: "Calificar", icon: Heart },
];

export default function VendorDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    
    // Check if MercadoPago was just connected
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mp_connected') === 'true') {
      toast({
        title: 'MercadoPago conectado',
        description: 'Tu cuenta de MercadoPago se conectó exitosamente',
      });
      // Clean URL
      window.history.replaceState({}, '', '/vendor');
    }
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/vendor-auth');
        return;
      }

      setUser(session.user);

      // Get vendor profile
      const { data: vendorData, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error || !vendorData) {
        toast({
          title: 'Error',
          description: 'No se encontró el perfil de vendedor',
          variant: 'destructive'
        });
        navigate('/vendor-auth');
        return;
      }

      setVendor(vendorData);
    } catch (error) {
      console.error('Error checking auth:', error);
      navigate('/vendor-auth');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/vendor-auth');
  };

  const handleMenuItemClick = (value: string) => {
    setActiveTab(value);
    setDrawerOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No autorizado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No tienes permisos para acceder a esta página.
            </p>
            <Button onClick={() => navigate('/vendor-auth')} className="w-full">
              Ir al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMenuItem = menuItems.find(item => item.value === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt userType="vendor" />
      {/* Mobile-responsive header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Botón hamburguesa - solo móvil */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img src={lapachoIcon} alt="Lapacho" className="h-6" />
                    {vendor.name}
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {menuItems.map((item) => (
                    <Button
                      key={item.value}
                      variant={activeTab === item.value ? "secondary" : "ghost"}
                      className="justify-start w-full"
                      onClick={() => handleMenuItemClick(item.value)}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                </nav>
                <div className="absolute bottom-6 left-4 right-4">
                  <Button 
                    onClick={handleSignOut} 
                    variant="outline" 
                    className="w-full"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <img src={lapachoIcon} alt="Lapacho" className="h-8 lg:hidden" />
            <h1 className="text-lg sm:text-xl font-bold truncate hidden lg:inline">
              {vendor.name}
            </h1>
          </div>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            size="sm"
            className="ml-2"
          >
            <LogOut className="mr-2 h-4 w-4 hidden sm:inline" />
            Salir
          </Button>
        </div>
      </div>
      
      {/* Dashboard tabs */}
      <div className="container mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* TabsList solo visible en desktop */}
          <TabsList className="hidden lg:flex flex-wrap gap-2 h-auto p-1 mb-6">
            {menuItems.map((item) => (
              <TabsTrigger 
                key={item.value} 
                value={item.value} 
                className="flex items-center gap-1"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Indicador de sección actual en móvil */}
          {currentMenuItem && (
            <div className="lg:hidden mb-4 flex items-center gap-2 px-1">
              <currentMenuItem.icon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{currentMenuItem.label}</h2>
            </div>
          )}

          <TabsContent value="dashboard">
            <VendorDashboardWithRealtime vendor={vendor} />
          </TabsContent>

          <TabsContent value="products">
            <VendorProductManager vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="offers">
            <VendorOffersManager vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="chats">
            <VendorDirectChat vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="reviews">
            <VendorReviews vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="hours">
            <VendorHoursManager vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="metrics">
            <div className="space-y-8">
              <VendorAnalyticsDashboard vendorId={vendor.id} />
              <VendorPaymentMetrics vendorId={vendor.id} />
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <VendorPaymentSettings vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="settings">
            <VendorSettings vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="support">
            <VendorSupportTickets vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="review">
            <PlatformReviewForm 
              userType="vendor"
              defaultName={vendor.name}
              defaultPhone={vendor.phone}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
