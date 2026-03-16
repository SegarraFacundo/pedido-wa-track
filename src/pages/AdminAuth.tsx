import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLocalePath } from "@/hooks/useLocalePath";
import lapachoIcon from "@/assets/lapacho-icon.png";

export default function AdminAuth() {
  const { t } = useTranslation();
  const lp = useLocalePath();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();
      
      if (roles) {
        navigate('/admin');
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (user) {
        toast({
          title: t('adminAuth.accountCreated'),
          description: "Ahora ve al SQL Editor de Supabase y ejecuta: SELECT public.make_user_admin('" + email + "');",
          duration: 10000,
        });
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (user) {
        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (roleError || !roles) {
          await supabase.auth.signOut();
          throw new Error(t('adminAuth.noAdminPermission') + " Ejecuta: SELECT public.make_user_admin('" + email + "'); en el SQL Editor");
        }

        toast({
          title: t('adminAuth.loginSuccess'),
          description: t('adminAuth.loginSuccessDesc'),
        });
        
        navigate('/admin');
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <img src={lapachoIcon} alt="Lapacho" className="h-20 w-auto" />
          </div>
          <CardTitle className="text-2xl text-center">{t('adminAuth.panelTitle')}</CardTitle>
          <CardDescription className="text-center">{t('adminAuth.panelDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder={t('adminAuth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={t('adminAuth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.processing') : (isSignUp ? t('adminAuth.createAdminAccount') : t('common.signIn'))}
            </Button>
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm"
              >
                {isSignUp ? t('adminAuth.hasAccount') : t('adminAuth.firstTime')}
              </Button>
            </div>
          </form>
          
          {isSignUp && (
            <div className="mt-4 p-4 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-2">{t('adminAuth.afterCreate')}</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{(t('adminAuth.afterCreateSteps', { returnObjects: true }) as string[])[0]}</li>
                <li>{(t('adminAuth.afterCreateSteps', { returnObjects: true }) as string[])[1]} <code className="bg-background px-1 py-0.5 rounded">SELECT public.make_user_admin('tu-email@ejemplo.com');</code></li>
                <li>{(t('adminAuth.afterCreateSteps', { returnObjects: true }) as string[])[2]}</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}