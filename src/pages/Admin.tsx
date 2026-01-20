import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Store, DollarSign, BarChart3, LogOut, Headphones, Bot, Star, 
  TrendingUp, Users, Wrench, AlertTriangle, Menu, FileText 
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import VendorManagement from "@/components/admin/VendorManagement";
import CommissionManagement from "@/components/admin/CommissionManagement";
import CommissionReports from "@/components/admin/CommissionReports";
import SupportPanel from "@/components/admin/SupportPanel";
import SoporteUserManagement from "@/components/admin/SoporteUserManagement";
import { PlatformReviewsPanel } from "@/components/admin/PlatformReviewsPanel";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { EvolutionConfig } from "@/components/EvolutionConfig";
import AdminPaymentMetrics from "@/components/admin/AdminPaymentMetrics";
import CommissionInvoiceGenerator from "@/components/admin/CommissionInvoiceGenerator";
import { VendorChangeAnalytics } from "@/components/admin/VendorChangeAnalytics";
import PharmacyProductLoader from "@/components/admin/PharmacyProductLoader";
import EmergencyControl from "@/components/admin/EmergencyControl";
import lapachoLogo from "@/assets/lapacho-logo.png";
import lapachoIcon from "@/assets/lapacho-icon.png";
import { cn } from "@/lib/utils";

const menuItems = [
  { value: "vendors", label: "Negocios", icon: Store },
  { value: "commissions", label: "Comisiones", icon: DollarSign },
  { value: "metrics", label: "Métricas", icon: BarChart3 },
  { value: "analytics", label: "Analytics", icon: TrendingUp },
  { value: "invoices", label: "Facturación", icon: FileText },
  { value: "reports", label: "Reportes", icon: BarChart3 },
  { value: "reviews", label: "Reseñas", icon: Star },
  { value: "support", label: "Tickets Soporte", icon: Headphones },
  { value: "soporte-users", label: "Usuarios Soporte", icon: Users },
  { value: "evolution", label: "Agente IA", icon: Bot },
  { value: "emergency", label: "Emergencia", icon: AlertTriangle, danger: true },
  { value: "tools", label: "Herramientas", icon: Wrench },
];

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("vendors");
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const handleMenuItemClick = (value: string) => {
    setActiveTab(value);
    setDrawerOpen(false);
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

  const currentMenuItem = menuItems.find(item => item.value === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt userType="admin" />
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
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
                    Panel Admin
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {menuItems.map((item) => (
                    <Button
                      key={item.value}
                      variant={activeTab === item.value ? "secondary" : "ghost"}
                      className={cn(
                        "justify-start w-full",
                        item.danger && activeTab === item.value && "bg-orange-500 text-white hover:bg-orange-600",
                        item.danger && activeTab !== item.value && "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      )}
                      onClick={() => handleMenuItemClick(item.value)}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <img src={lapachoIcon} alt="Lapacho" className="h-8 lg:hidden" />
            <img src={lapachoLogo} alt="Lapacho Logo" className="h-10 hidden lg:block" />
          </div>

          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* TabsList solo visible en desktop */}
          <TabsList className="hidden lg:grid w-full grid-cols-12 mb-8">
            {menuItems.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className={cn(
                  item.danger && "data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Indicador de sección actual en móvil */}
          {currentMenuItem && (
            <div className="lg:hidden mb-4 flex items-center gap-2 px-1">
              <currentMenuItem.icon className={cn(
                "h-5 w-5",
                currentMenuItem.danger ? "text-orange-500" : "text-primary"
              )} />
              <h2 className="text-lg font-semibold">{currentMenuItem.label}</h2>
            </div>
          )}

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

          <TabsContent value="soporte-users">
            <SoporteUserManagement />
          </TabsContent>

          <TabsContent value="evolution">
            <EvolutionConfig />
          </TabsContent>

          <TabsContent value="emergency">
            <EmergencyControl />
          </TabsContent>

          <TabsContent value="tools">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Herramientas de Administración</h2>
              <PharmacyProductLoader />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
