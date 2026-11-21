import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Receipt, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import type { CartItem, CustomerCart } from "@/types/cart";

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

interface OrderItemRaw {
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string | null;
  vendor_id: string;
  items: OrderItemRaw[] | null;
  vendors?: { name: string } | null;
}

export default function MyOrders() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const { toast } = useToast();
  const { cart, replaceCart } = useCart();
  const { isAuthenticated, loading: authLoading } = useCustomerAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);
  const [conflict, setConflict] = useState<CustomerCart | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, created_at, vendor_id, items, vendors(name)")
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    })();
  }, [isAuthenticated, authLoading]);

  /** Reconstruye el carrito con los productos ACTUALES del negocio (precio/stock de ahora). */
  const buildCartFromOrder = async (o: OrderRow): Promise<CustomerCart | null> => {
    const items = Array.isArray(o.items) ? o.items : [];
    const ids = items.map((i) => i.product_id).filter(Boolean) as string[];
    if (!o.vendor_id || ids.length === 0) {
      toast({ title: "No se puede repetir este pedido", variant: "destructive" });
      return null;
    }
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, is_available, stock_enabled, stock_quantity")
      .eq("vendor_id", o.vendor_id)
      .in("id", ids);
    const pmap = new Map((products ?? []).map((p: any) => [p.id, p]));

    const cartItems: CartItem[] = [];
    let dropped = 0;
    for (const it of items) {
      const p: any = it.product_id ? pmap.get(it.product_id) : null;
      const available = p && p.is_available !== false && (!p.stock_enabled || (p.stock_quantity ?? 0) > 0);
      if (!p || !available) {
        dropped++;
        continue;
      }
      let qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
      if (p.stock_enabled) qty = Math.min(qty, p.stock_quantity ?? 0);
      cartItems.push({ product_id: p.id, name: p.name, price: Number(p.price), quantity: qty });
    }

    if (cartItems.length === 0) {
      toast({ title: "Ya no hay productos disponibles de este pedido", variant: "destructive" });
      return null;
    }
    if (dropped > 0) {
      toast({
        title: "Algunos productos ya no están disponibles",
        description: "Agregamos al carrito los que sí.",
      });
    }
    return { vendor_id: o.vendor_id, vendor_name: o.vendors?.name ?? "", items: cartItems };
  };

  const handleReorder = async (o: OrderRow) => {
    setReordering(o.id);
    try {
      const next = await buildCartFromOrder(o);
      if (!next) return;
      // Si hay un carrito de OTRO negocio con ítems, pedir confirmación antes de reemplazar.
      if (cart.items.length > 0 && cart.vendor_id && cart.vendor_id !== next.vendor_id) {
        setConflict(next);
        return;
      }
      replaceCart(next);
      navigate(localePath("/carrito"));
    } finally {
      setReordering(null);
    }
  };

  const confirmReplace = () => {
    if (!conflict) return;
    replaceCart(conflict);
    setConflict(null);
    navigate(localePath("/carrito"));
  };

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
            <Card key={o.id} className="transition hover:shadow-md">
              <CardContent className="p-3">
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => navigate(localePath(`/pedido/${o.id}`))}
                >
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
                </button>
                <div className="mt-2 flex justify-end border-t pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reordering === o.id}
                    onClick={() => handleReorder(o)}
                  >
                    {reordering === o.id ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                    )}
                    Pedir de nuevo
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar el carrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu carrito tiene productos de <b>{cart.vendor_name}</b>. Sólo podés pedir de un negocio a la vez.
              Si seguís, lo vaciamos y armamos uno nuevo con <b>{conflict?.vendor_name}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>Vaciar y repetir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
