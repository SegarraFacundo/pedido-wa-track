import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Headphones } from "lucide-react";
import SupportPanel from "@/components/admin/SupportPanel";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import lapachoLogo from "@/assets/lapacho-logo.png";
import lapachoIcon from "@/assets/lapacho-icon.png";

export default function Soporte() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkSoporteAccess();
  }, []);

  const checkSoporteAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');

      if (error || !roles || roles.length === 0) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder al panel de soporte",
          variant: "destructive",
        });
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setUserRole(roles[0].role);
      setHasAccess(true);
    } catch (error) {
      console.error('Error checking soporte access:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
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

  if (!hasAccess && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-1 md:flex-initial">
                <img src={lapachoIcon} alt="Lapacho" className="h-8 md:hidden" />
                <img src={lapachoLogo} alt="Lapacho Logo" className="h-10 hidden md:block" />
                <span className="text-xl font-bold md:hidden">Lapacho</span>
              </div>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Inicio
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <Headphones className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-4">Panel de Soporte</h2>
            <p className="text-muted-foreground mb-6">
              Para acceder al panel de soporte necesitas iniciar sesión con una cuenta autorizada.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/admin-auth')} 
                className="w-full"
                size="lg"
              >
                Iniciar Sesión
              </Button>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                className="w-full"
              >
                Volver al Inicio
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt userType="soporte" />
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 justify-center md:justify-start flex-1 md:flex-initial">
              <img src={lapachoIcon} alt="Lapacho" className="h-8 md:hidden" />
              <img src={lapachoLogo} alt="Lapacho Logo" className="h-10 hidden md:block" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold md:hidden">Lapacho</h1>
                <p className="text-xs text-muted-foreground capitalize hidden md:block">Rol: {userRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                Inicio
              </Button>
              {userRole === 'admin' && (
                <Button variant="ghost" onClick={() => navigate('/admin')}>
                  Panel Admin
                </Button>
              )}
              <Button onClick={handleSignOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 text-center">
          <Headphones className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Sistema de Tickets de Soporte</h2>
          <p className="text-muted-foreground">
            Gestiona las consultas y problemas reportados por clientes y vendedores
          </p>
        </div>
        
        <SupportPanel />
      </main>
    </div>
  );
}
