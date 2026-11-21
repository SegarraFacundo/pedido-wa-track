import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { Mail, MailCheck } from "lucide-react";
import lapachoIcon from "@/assets/lapacho-icon.png";

interface CustomerLoginProps {
  title?: string;
  description?: string;
  /** URL de retorno tras el login (Google y magic link). Por defecto, la actual. */
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

export function CustomerLogin({ title, description, redirectTo }: CustomerLoginProps) {
  const { signInWithGoogle, signInWithEmailOtp } = useCustomerAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<null | "google" | "email">(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading("google");
    try {
      await signInWithGoogle(redirectTo);
      // signInWithOAuth redirige: no sigue acá.
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo iniciar sesión con Google", variant: "destructive" });
      setLoading(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ title: "Ingresá un email válido", variant: "destructive" });
      return;
    }
    setLoading("email");
    try {
      await signInWithEmailOtp(value, redirectTo);
      setSentTo(value);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo enviar el enlace", description: "Probá de nuevo en un momento.", variant: "destructive" });
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
          {description ?? "Entrá para hacer tu pedido y seguirlo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sentTo ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <MailCheck className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium">Te enviamos un enlace a {sentTo}</p>
            <p className="text-xs text-muted-foreground">
              Abrilo desde este dispositivo para entrar. Revisá también el spam.
            </p>
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setSentTo(null)}>
              Usar otro email
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogle}
              disabled={loading !== null}
            >
              <GoogleIcon />
              {loading === "google" ? "Abriendo Google…" : "Continuar con Google"}
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmail} className="space-y-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading !== null}
              />
              <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
                <Mail className="h-4 w-4" />
                {loading === "email" ? "Enviando…" : "Enviarme un enlace"}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center">
              Necesitás una cuenta para pedir. El teléfono te lo pedimos al confirmar el pedido.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
