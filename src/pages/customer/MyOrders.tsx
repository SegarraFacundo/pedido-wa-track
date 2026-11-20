import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Recibido", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  preparing: { label: "En preparación", variant: "default" },
  ready: { label: "Listo", variant: "default" },
  delivering: { label: "En camino", variant: "default" },
  delivered: { label: "Entregado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string | null;
  vendors?: { name: string } | null;
}

export default function MyOrders() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const { isAuthenticated, loading: authLoading } = useCustomerAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, created_at, vendors(name)")
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    })();
  }, [isAuthenticated, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Ingresá o hacé tu primer pedido para ver tu historial.</p>
        <Button onClick={() => navigate(localePath("/tienda"))}>Ver negocios</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mis pedidos</h1>
      {orders.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Todavía no hiciste pedidos.</div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card
              key={o.id}
              className="cursor-pointer transition hover:shadow-md"
              onClick={() => navigate(localePath(`/pedido/${o.id}`))}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{o.id.slice(0, 8)}</span>
                    <Badge variant={STATUS[o.status]?.variant ?? "secondary"}>
                      {STATUS[o.status]?.label ?? o.status}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {o.vendors?.name ?? ""}
                    {o.created_at ? ` · ${new Date(o.created_at).toLocaleDateString("es-AR")}` : ""}
                  </p>
                </div>
                <div className="font-semibold">{money(o.total)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
