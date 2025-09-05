import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { VendorDashboardWithRealtime } from '@/components/VendorDashboardWithRealtime';
import { VendorProductManager } from '@/components/VendorProductManager';
import { VendorHoursManager } from '@/components/VendorHoursManager';
import { VendorSettings } from '@/components/VendorSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Clock, Settings, LayoutDashboard } from 'lucide-react';

export default function VendorDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
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
      {/* Mobile-responsive header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {vendor.name}
          </h1>
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
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Productos</span>
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horarios</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Ajustes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <VendorDashboardWithRealtime vendor={vendor} />
          </TabsContent>

          <TabsContent value="products">
            <VendorProductManager vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="hours">
            <VendorHoursManager vendorId={vendor.id} />
          </TabsContent>

          <TabsContent value="settings">
            <VendorSettings vendorId={vendor.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}