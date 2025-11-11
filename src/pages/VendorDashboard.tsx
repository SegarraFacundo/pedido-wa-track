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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Clock, Settings, LayoutDashboard, Tag, Star, MessageCircle, LifeBuoy, CreditCard } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import lapachoIcon from "@/assets/lapacho-icon.png";

export default function VendorDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt userType="vendor" />
      {/* Mobile-responsive header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 justify-center md:justify-start flex-1 md:flex-initial">
            <img src={lapachoIcon} alt="Lapacho" className="h-8 md:hidden" />
            <h1 className="text-lg sm:text-xl font-bold truncate md:inline">
              <span className="md:hidden">Lapacho</span>
              <span className="hidden md:inline">{vendor.name}</span>
            </h1>
          </div>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            size="sm"
            className="ml-2"
          >
            Salir
          </Button>
        </div>
      </div>
      
      {/* Dashboard tabs */}
      <div className="container mx-auto p-4">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="flex flex-wrap gap-2 h-auto p-1 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Productos</span>
            </TabsTrigger>
            <TabsTrigger value="offers" className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Ofertas</span>
            </TabsTrigger>
            <TabsTrigger value="chats" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Chats</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Reseñas</span>
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horarios</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Ajustes</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-1">
              <LifeBuoy className="h-4 w-4" />
              <span className="hidden sm:inline">Soporte</span>
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="payments">
            <VendorPaymentSettings vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="settings">
            <VendorSettings vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="support">
            <VendorSupportTickets vendorId={vendor.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}