import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Store, DollarSign, BarChart3, LogOut, Headphones, Bot, Star, TrendingUp } from "lucide-react";
import VendorManagement from "@/components/admin/VendorManagement";
import CommissionManagement from "@/components/admin/CommissionManagement";
import CommissionReports from "@/components/admin/CommissionReports";
import SupportPanel from "@/components/admin/SupportPanel";
import { PlatformReviewsPanel } from "@/components/admin/PlatformReviewsPanel";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { EvolutionConfig } from "@/components/EvolutionConfig";
import AdminPaymentMetrics from "@/components/admin/AdminPaymentMetrics";
import CommissionInvoiceGenerator from "@/components/admin/CommissionInvoiceGenerator";
import { VendorChangeAnalytics } from "@/components/admin/VendorChangeAnalytics";
import lapachoLogo from "@/assets/lapacho-logo.png";
import lapachoIcon from "@/assets/lapacho-icon.png";

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/admin-auth');
        return;
      }

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (error || !roles) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos de administrador",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/admin-auth');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin-auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt userType="admin" />
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 justify-center md:justify-start flex-1 md:flex-initial">
            <img src={lapachoIcon} alt="Lapacho" className="h-8 md:hidden" />
            <img src={lapachoLogo} alt="Lapacho Logo" className="h-10 hidden md:block" />
            <h1 className="text-xl font-bold md:hidden">Lapacho</h1>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="vendors" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 mb-8">
            <TabsTrigger value="vendors">
              <Store className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Negocios</span>
            </TabsTrigger>
            <TabsTrigger value="commissions">
              <DollarSign className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Comisiones</span>
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Facturación</span>
            </TabsTrigger>
            <TabsTrigger value="reports">
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Reportes</span>
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Star className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Reseñas</span>
            </TabsTrigger>
            <TabsTrigger value="support">
              <Headphones className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Soporte</span>
            </TabsTrigger>
            <TabsTrigger value="evolution">
              <Bot className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Agente IA</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors">
            <VendorManagement />
          </TabsContent>

          <TabsContent value="commissions">
            <CommissionManagement />
          </TabsContent>

          <TabsContent value="metrics">
            <AdminPaymentMetrics />
          </TabsContent>

          <TabsContent value="analytics">
            <VendorChangeAnalytics />
          </TabsContent>

          <TabsContent value="invoices">
            <CommissionInvoiceGenerator />
          </TabsContent>

          <TabsContent value="reports">
            <CommissionReports />
          </TabsContent>

          <TabsContent value="reviews">
            <PlatformReviewsPanel />
          </TabsContent>

          <TabsContent value="support">
            <SupportPanel />
          </TabsContent>

          <TabsContent value="evolution">
            <EvolutionConfig />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
