import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Vendor } from "@/types/order";
import { 
  Store, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  ShoppingBag,
  UserCheck,
  Ban
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPanelProps {
  vendors: Vendor[];
  onToggleVendorStatus: (vendorId: string) => void;
}

const categoryIcons = {
  restaurant: "🍔",
  pharmacy: "💊",
  market: "🛒",
  other: "📦"
};

export function AdminPanel({ vendors, onToggleVendorStatus }: AdminPanelProps) {
  const activeVendors = vendors.filter(v => v.isActive).length;
  const totalRevenue = vendors.reduce((sum, v) => sum + (v.totalOrders * 45.5), 0); // Simulated average order value
  const totalOrders = vendors.reduce((sum, v) => sum + v.totalOrders, 0);
  
  const stats = [
    {
      title: "Vendedores Activos",
      value: activeVendors,
      total: vendors.length,
      icon: Store,
      className: "text-status-ready"
    },
    {
      title: "Total Pedidos",
      value: totalOrders,
      icon: ShoppingBag,
      className: "text-status-confirmed"
    },
    {
      title: "Ingresos Totales",
      value: `$${totalRevenue.toFixed(0)}`,
      icon: DollarSign,
      className: "text-status-delivered"
    },
    {
      title: "Tasa de Actividad",
      value: `${((activeVendors / vendors.length) * 100).toFixed(0)}%`,
      icon: Activity,
      className: "text-status-delivering"
    }
  ];
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent">
          Panel de Administración
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestiona vendedores y monitorea el rendimiento del sistema
        </p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-all hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.className}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.total && (
                <p className="text-xs text-muted-foreground mt-1">
                  de {stat.total} totales
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Vendors Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestión de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="active">Activos</TabsTrigger>
              <TabsTrigger value="inactive">Inactivos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              {vendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onToggleStatus={onToggleVendorStatus}
                />
              ))}
            </TabsContent>
            
            <TabsContent value="active" className="space-y-4">
              {vendors
                .filter(v => v.isActive)
                .map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onToggleStatus={onToggleVendorStatus}
                  />
                ))}
            </TabsContent>
            
            <TabsContent value="inactive" className="space-y-4">
              {vendors
                .filter(v => !v.isActive)
                .map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onToggleStatus={onToggleVendorStatus}
                  />
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function VendorCard({ 
  vendor, 
  onToggleStatus 
}: { 
  vendor: Vendor; 
  onToggleStatus: (vendorId: string) => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-all",
      vendor.isActive ? "bg-card" : "bg-muted/50"
    )}>
      <div className="flex items-center gap-4">
        <div className="text-3xl">
          {categoryIcons[vendor.category]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{vendor.name}</h3>
            <Badge variant={vendor.isActive ? "default" : "secondary"}>
              {vendor.isActive ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{vendor.phone}</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-muted-foreground">
              📦 {vendor.totalOrders} pedidos
            </span>
            <span className="text-xs text-muted-foreground">
              ⭐ {vendor.rating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              📅 {new Date(vendor.joinedAt).toLocaleDateString('es-AR')}
            </span>
          </div>
        </div>
      </div>
      
      <Button
        variant={vendor.isActive ? "destructive" : "default"}
        size="sm"
        onClick={() => onToggleStatus(vendor.id)}
        className={vendor.isActive ? "" : "bg-gradient-primary hover:opacity-90"}
      >
        {vendor.isActive ? (
          <>
            <Ban className="h-4 w-4 mr-1" />
            Desactivar
          </>
        ) : (
          <>
            <UserCheck className="h-4 w-4 mr-1" />
            Activar
          </>
        )}
      </Button>
    </div>
  );
}