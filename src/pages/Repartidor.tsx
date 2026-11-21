import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, MapPin, Phone, Package, Store as StoreIcon, Navigation, Bike } from "lucide-react";
import lapachoIcon from "@/assets/logo-icon-light.svg";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const mapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

interface Item {
  delivery_id: string;
  status: string;
  fee: number;
  order: { id: string; address: string; total: number; items: any[]; phone: string; name: string; notes: string | null; delivery_type: string };
  vendor: { name: string; address: string; phone: string };
}
interface Feed {
  courier: { id: string; name: string; is_online: boolean; is_active: boolean; payout_fee: number };
  available: Item[];
  active: Item[];
  today: { count: number; earnings: number };
}

export default function Repartidor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("repartidor-feed");
    if (error || !data || data.error) {
      toast({ title: "No se pudo cargar", description: data?.error, variant: "destructive" });
      if (data?.error === "No sos repartidor") navigate("/repartidor-auth");
      setLoading(false);
      return;
    }
    setFeed(data as Feed);
    setOnline((data as Feed).courier.is_online);
    setLoading(false);
  }, [navigate, toast]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/repartidor-auth");
        return;
      }
      await loadFeed();
    })();
    const t = setInterval(() => loadFeed(), 20000);
    return () => clearInterval(t);
  }, [loadFeed, navigate]);

  const toggleOnline = async (v: boolean) => {
    if (!feed) return;
    setOnline(v);
    await supabase.from("couriers").update({ is_online: v }).eq("id", feed.courier.id);
  };

  const act = async (deliveryId: string, action: string) => {
    setBusy(deliveryId);
    try {
      const { data, error } = await supabase.functions.invoke("repartidor-accion", { body: { delivery_id: deliveryId, action } });
      if (error || data?.error) {
        toast({ title: "No se pudo", description: data?.error, variant: "destructive" });
        return;
      }
      await loadFeed();
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/repartidor-auth");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderActive = (it: Item) => (
    <Card key={it.delivery_id} className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Badge>{STATUS_LABEL[it.status] ?? it.status}</Badge>
          <span className="text-sm font-semibold text-primary">Ganás {money(it.fee)}</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <StoreIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium">Retiro: {it.vendor.name}</p>
              <a href={mapsUrl(it.vendor.address)} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-2 hover:underline">
                {it.vendor.address}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Entrega: {it.order.name}</p>
              <a href={mapsUrl(it.order.address)} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-2 hover:underline">
                {it.order.address}
              </a>
            </div>
          </div>
          {it.order.notes && (
            <p className="rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              📝 {it.order.notes}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {it.order.phone && (
              <a href={`tel:${it.order.phone}`} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                <Phone className="h-3 w-3" /> Cliente
              </a>
            )}
            {it.vendor.phone && (
              <a href={`tel:${it.vendor.phone}`} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                <Phone className="h-3 w-3" /> Negocio
              </a>
            )}
            <a href={mapsUrl(it.order.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
              <Navigation className="h-3 w-3" /> Ir
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          {it.status === "assigned" && (
            <>
              <Button className="flex-1" disabled={busy === it.delivery_id} onClick={() => act(it.delivery_id, "picked_up")}>
                Retiré el pedido
              </Button>
              <Button variant="outline" disabled={busy === it.delivery_id} onClick={() => act(it.delivery_id, "release")}>
                Soltar
              </Button>
            </>
          )}
          {it.status === "picked_up" && (
            <Button className="flex-1" disabled={busy === it.delivery_id} onClick={() => act(it.delivery_id, "delivering")}>
              En camino
            </Button>
          )}
          {it.status === "delivering" && (
            <Button className="flex-1" disabled={busy === it.delivery_id} onClick={() => act(it.delivery_id, "delivered")}>
              Entregué
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderAvailable = (it: Item) => (
    <Card key={it.delivery_id}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">{it.vendor.name}</p>
          <span className="text-sm font-semibold text-primary">Ganás {money(feed?.courier.payout_fee ?? 0)}</span>
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <StoreIcon className="h-3.5 w-3.5" /> {it.vendor.address}
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {it.order.address}
        </p>
        <Button className="w-full" disabled={busy === it.delivery_id || !online} onClick={() => act(it.delivery_id, "take")}>
          {busy === it.delivery_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Tomar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={lapachoIcon} alt="Lapacho" className="h-7" />
            <span className="font-semibold">{feed?.courier.name ?? "Repartidor"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        {/* Online + stats */}
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Bike className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">{online ? "Disponible" : "No disponible"}</p>
                <p className="text-xs text-muted-foreground">
                  Hoy: {feed?.today.count ?? 0} entregas · {money(feed?.today.earnings ?? 0)}
                </p>
              </div>
            </div>
            <Switch checked={online} onCheckedChange={toggleOnline} />
          </CardContent>
        </Card>

        {/* Reparto activo */}
        {feed && feed.active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Mi reparto activo</h2>
            {feed.active.map(renderActive)}
          </section>
        )}

        {/* Pool de disponibles */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Pedidos disponibles</h2>
          {!online ? (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Activá <b>Disponible</b> para ver y tomar pedidos.
            </p>
          ) : !feed || feed.available.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Package className="h-10 w-10" />
              <p>No hay pedidos disponibles ahora.</p>
            </div>
          ) : (
            feed.available.map(renderAvailable)
          )}
        </section>
      </main>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  assigned: "Tomado",
  picked_up: "Retirado",
  delivering: "En camino",
};
