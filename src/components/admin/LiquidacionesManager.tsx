import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2, Check } from "lucide-react";

// couriers/deliveries/courier_payouts todavía no están en los tipos generados.
const sb = () => supabase as any;
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

interface Pending {
  courier_id: string;
  name: string;
  count: number;
  total: number;
}
interface Payout {
  id: string;
  courier_id: string;
  name: string;
  period_start: string | null;
  period_end: string | null;
  total_deliveries: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export default function LiquidacionesManager() {
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: couriers } = await sb().from("couriers").select("id, name");
    const names = new Map((couriers ?? []).map((c: any) => [c.id, c.name]));

    // Entregas entregadas y todavía no liquidadas.
    const { data: dels } = await sb()
      .from("deliveries")
      .select("courier_id, fee")
      .eq("status", "delivered")
      .is("payout_id", null);
    const agg = new Map<string, { count: number; total: number }>();
    for (const d of dels ?? []) {
      if (!d.courier_id) continue;
      const cur = agg.get(d.courier_id) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(d.fee) || 0;
      agg.set(d.courier_id, cur);
    }
    setPending(
      Array.from(agg.entries()).map(([courier_id, v]) => ({
        courier_id,
        name: (names.get(courier_id) as string) || "Repartidor",
        count: v.count,
        total: v.total,
      })),
    );

    const { data: pos } = await sb()
      .from("courier_payouts")
      .select("*")
      .order("created_at", { ascending: false });
    setPayouts(
      (pos ?? []).map((p: any) => ({ ...p, name: (names.get(p.courier_id) as string) || "Repartidor" })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const liquidar = async (courierId: string) => {
    setBusy(courierId);
    try {
      const { data: dels } = await sb()
        .from("deliveries")
        .select("id, fee, delivered_at")
        .eq("courier_id", courierId)
        .eq("status", "delivered")
        .is("payout_id", null);
      if (!dels || dels.length === 0) {
        toast({ title: "Nada para liquidar", variant: "destructive" });
        return;
      }
      const total = dels.reduce((s: number, d: any) => s + (Number(d.fee) || 0), 0);
      const dates = dels.map((d: any) => d.delivered_at).filter(Boolean).sort();
      const { data: payout, error } = await sb()
        .from("courier_payouts")
        .insert({
          courier_id: courierId,
          period_start: dates[0] ? dates[0].slice(0, 10) : null,
          period_end: dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 10) : null,
          total_deliveries: dels.length,
          total_amount: total,
          status: "pending",
        })
        .select()
        .single();
      if (error || !payout) throw new Error(error?.message || "No se pudo crear la liquidación");
      await sb().from("deliveries").update({ payout_id: payout.id }).in("id", dels.map((d: any) => d.id));
      toast({ title: "Liquidación generada", description: `${dels.length} entregas · ${money(total)}` });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (payoutId: string) => {
    setBusy(payoutId);
    try {
      await sb().from("courier_payouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", payoutId);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Pendiente de liquidar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entregas pendientes de liquidar.</p>
          ) : (
            pending.map((p) => (
              <div key={p.courier_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.count} entregas · {money(p.total)}
                  </p>
                </div>
                <Button size="sm" disabled={busy === p.courier_id} onClick={() => liquidar(p.courier_id)}>
                  {busy === p.courier_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Liquidar
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay liquidaciones.</p>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                      {p.status === "paid" ? "Pagada" : "Pendiente"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.total_deliveries} entregas · {money(Number(p.total_amount))}
                    {p.period_start ? ` · ${p.period_start} a ${p.period_end}` : ""}
                  </p>
                </div>
                {p.status !== "paid" && (
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => markPaid(p.id)}>
                    {busy === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Marcar pagada
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
