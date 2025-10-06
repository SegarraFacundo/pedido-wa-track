import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import lapachoLogo from '@/assets/lapacho-logo.png';

export default function VendorAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Check if vendor profile exists
        checkVendorProfile(session.user.id);
      }
    });

    // Listen for auth changes
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
      navigate('/vendor-dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign up with vendor role
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'vendor'
          },
          emailRedirectTo: `${window.location.origin}/vendor-auth`
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create vendor profile
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
          title: '✅ Cuenta creada',
          description: 'Por favor verifica tu email antes de iniciar sesión',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      toast({
        title: '✅ Bienvenido',
        description: 'Iniciando sesión...',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ya has iniciado sesión</CardTitle>
            <CardDescription>
              {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/vendor-dashboard')}
              className="w-full"
            >
              Ir al Panel de Vendedor
            </Button>
            <Button 
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Cerrar Sesión
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
          <div className="flex justify-center mb-4">
            <img src={lapachoLogo} alt="Lapacho Logo" className="h-16" />
          </div>
          <CardTitle>Panel de Vendedor</CardTitle>
          <CardDescription>
            Accede a tu panel para gestionar pedidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="vendedor@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Contraseña</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-name">Nombre del Negocio</Label>
                  <Input
                    id="vendor-name"
                    type="text"
                    placeholder="Mi Restaurante"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="vendedor@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Después de registrarte, verifica tu email para activar tu cuenta.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}