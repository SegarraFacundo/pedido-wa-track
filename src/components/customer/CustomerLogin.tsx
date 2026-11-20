import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { User } from "lucide-react";
import lapachoIcon from "@/assets/lapacho-icon.png";

interface CustomerLoginProps {
  /** Se llama cuando el invitado entra (Google redirige, así que ahí no aplica). */
  onDone?: () => void;
  title?: string;
  description?: string;
  /** URL de retorno tras el login con Google. Por defecto, la actual. */
  redirectTo?: string;
}

/** Icono de Google (marca). lucide no trae logos de marca. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 8.1 29.3 6 24 6 12.9 6 4 14.9 4 26s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 8.1 29.3 6 24 6 16.3 6 9.7 10.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.9 26.7 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41.6 16.2 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36.5 44 31.7 44 26c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  );
}

export function CustomerLogin({ onDone, title, description, redirectTo }: CustomerLoginProps) {
  const { signInWithGoogle, continueAsGuest } = useCustomerAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<null | "google" | "guest">(null);

  const handleGoogle = async () => {
    setLoading("google");
    try {
      await signInWithGoogle(redirectTo);
      // signInWithOAuth redirige: no hace falta onDone acá.
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo iniciar sesión con Google", variant: "destructive" });
      setLoading(null);
    }
  };

  const handleGuest = async () => {
    setLoading("guest");
    try {
      await continueAsGuest();
      onDone?.();
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo continuar como invitado", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center">
        <img src={lapachoIcon} alt="Lapacho" className="h-12 w-12 mx-auto mb-2" />
        <CardTitle>{title ?? "Ingresá a Lapacho"}</CardTitle>
        <CardDescription>
          {description ?? "Entrá con Google o seguí como invitado para hacer tu pedido."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogle}
          disabled={loading !== null}
        >
          <GoogleIcon />
          {loading === "google" ? "Abriendo Google…" : "Continuar con Google"}
        </Button>

        <Button
          variant="ghost"
          className="w-full gap-2"
          onClick={handleGuest}
          disabled={loading !== null}
        >
          <User className="h-4 w-4" />
          {loading === "guest" ? "Entrando…" : "Seguir como invitado"}
        </Button>

        <p className="text-xs text-muted-foreground text-center pt-1">
          Como invitado podés pedir igual. El teléfono te lo pedimos al confirmar el pedido.
        </p>
      </CardContent>
    </Card>
  );
}
