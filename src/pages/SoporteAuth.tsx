import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Headphones } from "lucide-react";
import lapachoLogo from "@/assets/lapacho-logo.png";

export default function SoporteAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("No se pudo obtener la información del usuario");
      }

      // Verificar que el usuario tiene rol de soporte o admin
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .in('role', ['admin', 'soporte']);

      if (rolesError) {
        console.error('Error checking roles:', rolesError);
        throw new Error("Error al verificar permisos");
      }

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder al panel de soporte",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido al panel de soporte",
      });

      navigate("/soporte");
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Verifica tus credenciales e intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={lapachoLogo} alt="Lapacho Logo" className="h-16 mx-auto mb-4" />
          <Headphones className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Panel de Soporte</h1>
          <p className="text-muted-foreground">
            Ingresa con tu cuenta de soporte
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Volver al Inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
