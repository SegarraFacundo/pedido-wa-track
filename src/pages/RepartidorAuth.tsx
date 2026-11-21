import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bike } from "lucide-react";
import lapachoLogo from "@/assets/logo-text-light.svg";

export default function RepartidorAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo obtener el usuario");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .in("role", ["repartidor", "admin"]);

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast({ title: "Acceso denegado", description: "No tenés permisos de repartidor", variant: "destructive" });
        setLoading(false);
        return;
      }
      navigate("/repartidor");
    } catch (error: any) {
      toast({ title: "Error al iniciar sesión", description: error.message || "Verificá tus datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={lapachoLogo} alt="Lapacho" className="mx-auto mb-4 h-14" />
          <Bike className="mx-auto mb-3 h-11 w-11 text-primary" />
          <h1 className="mb-1 text-2xl font-bold">Repartidores</h1>
          <p className="text-muted-foreground">Ingresá para ver y tomar pedidos</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Correo electrónico</label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>Volver al Inicio</Button>
        </div>
      </div>
    </div>
  );
}
