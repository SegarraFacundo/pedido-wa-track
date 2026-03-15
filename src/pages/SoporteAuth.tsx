import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import lapachoLogo from "@/assets/lapacho-logo.png";

export default function SoporteAuth() {
  const { t } = useTranslation();
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
        throw new Error(t('vendorAuth.noAuthUser'));
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .in('role', ['admin', 'soporte']);

      if (rolesError) {
        console.error('Error checking roles:', rolesError);
        throw new Error(t('common.error'));
      }

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast({
          title: t('soporteAuth.accessDenied'),
          description: t('soporteAuth.accessDeniedDesc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: t('soporteAuth.loginSuccess'),
        description: t('soporteAuth.loginSuccessDesc'),
      });

      navigate("/soporte");
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: t('soporteAuth.loginError'),
        description: error.message || t('soporteAuth.loginErrorDesc'),
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
          <h1 className="text-3xl font-bold mb-2">{t('soporteAuth.panelTitle')}</h1>
          <p className="text-muted-foreground">{t('soporteAuth.panelDesc')}</p>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">{t('soporteAuth.emailLabel')}</label>
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
              <label htmlFor="password" className="text-sm font-medium">{t('soporteAuth.passwordLabel')}</label>
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
              {loading ? t('soporteAuth.signingIn') : t('common.signIn')}
            </Button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('common.backHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}