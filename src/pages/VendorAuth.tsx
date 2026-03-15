import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '@/hooks/useLocalePath';
import lapachoIcon from '@/assets/lapacho-icon.png';

export default function VendorAuth() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasVendorProfile, setHasVendorProfile] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkVendorProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN') {
          checkVendorProfile(session.user.id);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkVendorProfile = async (userId: string) => {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (vendor) {
      setHasVendorProfile(true);
      navigate('/vendor-dashboard');
    } else {
      setHasVendorProfile(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error(t('vendorAuth.noAuthUser'));

      const { error: vendorError } = await supabase
        .from('vendors')
        .insert({
          user_id: user.id,
          name: vendorName,
          category: 'restaurant',
          phone: '',
          address: '',
          is_active: false
        });

      if (vendorError) throw vendorError;

      toast({
        title: t('vendorAuth.profileCreated'),
        description: t('vendorAuth.profileCreatedDesc'),
      });

      navigate('/vendor-dashboard');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'vendor' },
          emailRedirectTo: `${window.location.origin}/vendor-auth`
        }
      });

      if (error) throw error;

      if (data.user) {
        const { error: vendorError } = await supabase
          .from('vendors')
          .insert({
            user_id: data.user.id,
            name: vendorName,
            category: 'restaurant',
            phone: '',
            address: '',
            is_active: false
          });

        if (vendorError) throw vendorError;

        toast({
          title: t('vendorAuth.accountCreated'),
          description: t('vendorAuth.accountCreatedDesc'),
        });
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      toast({
        title: t('vendorAuth.welcome'),
        description: t('vendorAuth.welcomeDesc'),
      });
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        errorMessage = t('vendorAuth.networkError');
      } else if (error.message?.includes('Invalid login credentials')) {
        errorMessage = t('vendorAuth.invalidCredentials');
      }
      
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (user) {
    if (hasVendorProfile === false) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-center mb-6">
                <img src={lapachoIcon} alt="Lapacho" className="h-20 w-auto" />
              </div>
              <CardTitle>{t('vendorAuth.createProfileTitle')}</CardTitle>
              <CardDescription>
                {t('vendorAuth.createProfileDesc', { email: user.email })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-name">{t('vendorAuth.businessName')}</Label>
                  <Input
                    id="vendor-name"
                    type="text"
                    placeholder={t('vendorAuth.businessPlaceholder')}
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('vendorAuth.creatingProfile') : t('vendorAuth.createProfile')}
                </Button>
                <Button type="button" onClick={handleSignOut} variant="outline" className="w-full">
                  {t('common.signOut')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('vendorAuth.alreadyLoggedIn')}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/vendor-dashboard')} className="w-full">
              {t('vendorAuth.goToDashboard')}
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              {t('common.signOut')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-6">
            <img src={lapachoIcon} alt="Lapacho" className="h-20 w-auto" />
          </div>
          <CardTitle>{t('vendorAuth.panelTitle')}</CardTitle>
          <CardDescription>{t('vendorAuth.panelDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('vendorAuth.emailLabel')}</Label>
              <Input id="email" type="email" placeholder={t('vendorAuth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('vendorAuth.passwordLabel')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('vendorAuth.signingIn') : t('common.signIn')}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-center text-muted-foreground mb-4">{t('vendorAuth.noAccount')}</p>
            <Button variant="outline" className="w-full" onClick={() => {
              const whatsappNumber = '5493464448309';
              const message = encodeURIComponent('Hola, quiero registrar mi negocio en Lapacho');
              window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
            }}>
              <MessageSquare className="mr-2 h-4 w-4" />
              {t('vendorAuth.contactToRegister')}
            </Button>
          </div>
          <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/')}>{t('common.backHome')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}