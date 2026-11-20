import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Minus, Plus, Store as StoreIcon, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useCart } from "@/hooks/useCart";
import { isVendorOpen } from "@/lib/timezone";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

interface Vendor {
  id: string;
  name: string;
  category: string;
  image: string | null;
  address: string;
  opening_time: string | null;
  closing_time: string | null;
  days_open: string[] | null;
  allows_pickup: boolean | null;
  allows_delivery: boolean | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  is_available: boolean | null;
  stock_enabled: boolean | null;
  stock_quantity: number | null;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number | null;
  offer_price: number | null;
  original_price: number | null;
  valid_until: string | null;
}

export default function Store() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const { cart, count, subtotal, addItem, replaceVendor, setQuantity } = useCart();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState<Product | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const [{ data: v }, { data: p }, { data: o }] = await Promise.all([
        supabase
          .from("public_vendors")
          .select("id, name, category, image, address, opening_time, closing_time, days_open, allows_pickup, allows_delivery")
          .eq("id", vendorId)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name, description, price, image, is_available, stock_enabled, stock_quantity")
          .eq("vendor_id", vendorId)
          .order("name"),
        supabase
          .from("vendor_offers")
          .select("id, title, description, discount_percentage, offer_price, original_price, valid_until")
          .eq("vendor_id", vendorId)
          .eq("is_active", true),
      ]);
      setVendor((v as Vendor) ?? null);
      setProducts(((p as Product[]) ?? []).filter((x) => x.is_available !== false));
      setOffers(((o as Offer[]) ?? []).filter((x) => !x.valid_until || x.valid_until >= nowIso));
      setLoading(false);
    })();
  }, [vendorId]);

  const qtyOf = (productId: string) =>
    cart.vendor_id === vendorId ? cart.items.find((i) => i.product_id === productId)?.quantity ?? 0 : 0;

  const tryAdd = (p: Product) => {
    if (!vendor) return;
    const ok = addItem(vendor.id, vendor.name, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 });
    if (!ok) setConflict(p);
  };

  const confirmReplace = () => {
    if (!vendor || !conflict) return;
    replaceVendor(vendor.id, vendor.name, {
      product_id: conflict.id,
      name: conflict.name,
      price: Number(conflict.price),
      quantity: 1,
    });
    setConflict(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="py-10 text-center">
        <p className="text-muted-foreground">No encontramos este negocio.</p>
        <Button variant="link" onClick={() => navigate(localePath("/tienda"))}>
          Volver a la tienda
        </Button>
      </div>
    );
  }

  const open = isVendorOpen(vendor.days_open, vendor.opening_time, vendor.closing_time, false);

  return (
    <div className="space-y-4 pb-24">
      <button onClick={() => navigate(localePath("/tienda"))} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Negocios
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {vendor.image ? (
            <img src={vendor.image} alt={vendor.name} className="h-full w-full object-cover" />
          ) : (
            <StoreIcon className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{vendor.name}</h1>
            <Badge variant={open ? "default" : "secondary"}>{open ? "Abierto" : "Cerrado"}</Badge>
          </div>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {vendor.address}
          </p>
          <div className="mt-1 flex gap-2">
            {vendor.allows_delivery !== false && <Badge variant="outline">Delivery</Badge>}
            {vendor.allows_pickup && <Badge variant="outline">Retiro</Badge>}
          </div>
        </div>
      </div>

      {!open && (
        <p className="flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" /> El negocio está cerrado ahora. Podés mirar el menú igual.
        </p>
      )}

      {offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((o) => (
            <Card key={o.id} className="border-primary/40 bg-primary/5">
              <CardContent className="flex items-start gap-3 p-3">
                <Tag className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{o.title}</h3>
                    {o.discount_percentage ? <Badge>{o.discount_percentage}% OFF</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{o.description}</p>
                  {o.offer_price != null && (
                    <p className="mt-0.5 text-sm">
                      <span className="font-semibold">{money(Number(o.offer_price))}</span>
                      {o.original_price != null && (
                        <span className="ml-2 text-muted-foreground line-through">{money(Number(o.original_price))}</span>
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {products.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Este negocio todavía no cargó productos.</p>
        ) : (
          products.map((p) => {
            const qty = qtyOf(p.id);
            const noStock = p.stock_enabled && (p.stock_quantity ?? 0) <= 0;
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  {p.image && (
                    <img src={p.image} alt={p.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{p.name}</h3>
                    {p.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    )}
                    <p className="mt-0.5 font-semibold">{money(Number(p.price))}</p>
                  </div>
                  {noStock ? (
                    <Badge variant="secondary">Sin stock</Badge>
                  ) : qty > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity(p.id, qty - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-5 text-center font-medium">{qty}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => tryAdd(p)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => tryAdd(p)}>
                      Agregar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {count > 0 && cart.vendor_id === vendorId && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Button className="flex-1 justify-between" onClick={() => navigate(localePath("/carrito"))}>
              <span>Ver carrito ({count})</span>
              <span>{money(subtotal)}</span>
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Empezar un carrito nuevo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu carrito tiene productos de <b>{cart.vendor_name}</b>. Sólo podés pedir de un negocio a la vez.
              Si seguís, vaciamos el carrito y empezamos con <b>{vendor.name}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>Vaciar y empezar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
