import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Mail, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SoporteUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function SoporteUserManagement() {
  const [users, setUsers] = useState<SoporteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SoporteUser | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  useEffect(() => {
    fetchSoporteUsers();
  }, []);

  const fetchSoporteUsers = async () => {
    try {
      setLoading(true);
      
      // Get users with soporte role
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'soporte');

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        setUsers([]);
        return;
      }

      const userIds = userRoles.map(ur => ur.user_id);

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .in('id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setUsers(profiles || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSoporteUser = async () => {
    try {
      if (!formData.email || !formData.password) {
        throw new Error("Email y contraseña son requeridos");
      }

      setLoading(true);

      // Create user in auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name || null,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      // Update profile with full_name if provided
      if (formData.full_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: formData.full_name })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
      }

      // Assign soporte role using the database function
      const { data: functionData, error: functionError } = await supabase
        .rpc('make_user_soporte', { user_email: formData.email });

      if (functionError) throw functionError;

      toast({
        title: "✅ Usuario de soporte creado",
        description: `${formData.email} ahora tiene acceso al panel de soporte`,
      });

      setFormData({ email: "", password: "", full_name: "" });
      setDialogOpen(false);
      fetchSoporteUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSoporteRole = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      // Remove soporte role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id)
        .eq('role', 'soporte');

      if (error) throw error;

      toast({
        title: "✅ Rol removido",
        description: `${selectedUser.email} ya no tiene acceso al panel de soporte`,
      });

      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchSoporteUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando usuarios de soporte...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Usuarios de Soporte</h2>
          <p className="text-muted-foreground">
            Gestiona los usuarios con acceso al panel de soporte
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear Usuario de Soporte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Usuario de Soporte</DialogTitle>
              <DialogDescription>
                Crea un nuevo usuario con acceso al panel de soporte
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline mr-2 h-4 w-4" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="soporte@ejemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  <Key className="inline mr-2 h-4 w-4" />
                  Contraseña *
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre Completo (opcional)</Label>
                <Input
                  id="full_name"
                  placeholder="Juan Pérez"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={createSoporteUser}
                disabled={loading || !formData.email || !formData.password}
                className="w-full"
              >
                {loading ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay usuarios de soporte creados
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Crea el primer usuario de soporte para comenzar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {user.full_name || "Sin nombre"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user.email}
                    </p>
                  </div>
                  <Badge variant="secondary">Soporte</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Creado: {new Date(user.created_at).toLocaleDateString('es-AR')}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedUser(user);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover Acceso
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Remover acceso de soporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Se removerá el rol de soporte de <strong>{selectedUser?.email}</strong>.
              El usuario ya no podrá acceder al panel de soporte, pero su cuenta seguirá existiendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeSoporteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover Acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
