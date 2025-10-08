import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pause, Play, Edit, UserPlus, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  payment_status: string;
  suspended_reason: string | null;
  total_orders: number;
  user_id: string | null;
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkUserDialogOpen, setLinkUserDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const { toast } = useToast();

  const [linkUserData, setLinkUserData] = useState({
    email: "",
    password: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    phone: "",
    address: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
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

  const createVendor = async () => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Error creando usuario');

      // Create vendor record
      const { error: vendorError } = await supabase
        .from('vendors')
        .insert({
          name: formData.name,
          category: formData.category,
          phone: formData.phone,
          address: formData.address,
          user_id: authData.user.id,
          payment_status: 'active',
        });

      if (vendorError) throw vendorError;

      // Assign vendor role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'vendor',
        });

      if (roleError) throw roleError;

      toast({
        title: "Negocio creado",
        description: "El negocio ha sido creado exitosamente",
      });

      setDialogOpen(false);
      setFormData({
        name: "",
        category: "",
        phone: "",
        address: "",
        email: "",
        password: "",
      });
      fetchVendors();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleVendorStatus = async (vendorId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { error } = await supabase
        .from('vendors')
        .update({ 
          payment_status: newStatus,
          suspended_reason: newStatus === 'suspended' ? 'Suspendido por falta de pago' : null
        })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: newStatus === 'active' ? "Negocio activado" : "Negocio suspendido",
        description: `El negocio ha sido ${newStatus === 'active' ? 'activado' : 'suspendido'}`,
      });

      fetchVendors();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createUserForVendor = async () => {
    if (!selectedVendor) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-vendor-user', {
        body: {
          email: linkUserData.email,
          password: linkUserData.password,
          vendorId: selectedVendor.id
        }
      });

      if (error) throw error;

      toast({
        title: "Usuario creado",
        description: `Usuario creado y vinculado exitosamente al negocio ${selectedVendor.name}`,
      });

      setLinkUserDialogOpen(false);
      setLinkUserData({ email: "", password: "" });
      setSelectedVendor(null);
      fetchVendors();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unlinkUserFromVendor = async (vendorId: string, vendorName: string) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ user_id: null })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: "Usuario desvinculado",
        description: `Usuario desvinculado exitosamente del negocio ${vendorName}`,
      });

      fetchVendors();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Cargando negocios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Gestión de Negocios</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Crear Negocio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Negocio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Nombre del negocio"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                placeholder="Categoría"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
              <Input
                placeholder="Teléfono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Textarea
                placeholder="Dirección"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Email para acceso"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <Button onClick={createVendor} className="w-full">
                Crear Negocio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <Card key={vendor.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{vendor.name}</CardTitle>
                <Badge variant={vendor.payment_status === 'active' ? 'default' : 'destructive'}>
                  {vendor.payment_status === 'active' ? 'Activo' : 'Suspendido'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{vendor.category}</p>
              <p className="text-sm">{vendor.phone}</p>
              <p className="text-sm text-muted-foreground">{vendor.address}</p>
              <p className="text-sm font-semibold">
                Total pedidos: {vendor.total_orders}
              </p>
              {!vendor.user_id && (
                <Badge variant="outline" className="text-yellow-600">
                  Sin usuario
                </Badge>
              )}
              {vendor.suspended_reason && (
                <p className="text-sm text-destructive">{vendor.suspended_reason}</p>
              )}
              <div className="pt-4 flex gap-2">
                <Button
                  size="sm"
                  variant={vendor.payment_status === 'active' ? 'destructive' : 'default'}
                  onClick={() => toggleVendorStatus(vendor.id, vendor.payment_status)}
                  className="flex-1"
                >
                  {vendor.payment_status === 'active' ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Suspender
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Activar
                    </>
                  )}
                </Button>
                {!vendor.user_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setLinkUserDialogOpen(true);
                    }}
                    title="Crear usuario"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unlinkUserFromVendor(vendor.id, vendor.name)}
                    title="Desvincular usuario"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={linkUserDialogOpen} onOpenChange={setLinkUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Usuario para {selectedVendor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="email"
              placeholder="Email"
              value={linkUserData.email}
              onChange={(e) => setLinkUserData({ ...linkUserData, email: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={linkUserData.password}
              onChange={(e) => setLinkUserData({ ...linkUserData, password: e.target.value })}
            />
            <Button onClick={createUserForVendor} className="w-full">
              Crear Usuario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
