import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Trash2, Plus, Loader2 } from "lucide-react";

// coupons todavía no está en los tipos generados de Supabase.
const sb = () => supabase as any;
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order: number | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  code: "",
  discount_type: "percent",
  discount_value: "",
  min_order: "",
  valid_until: "",
  max_uses: "",
};

export default function CouponsManager() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    const { data } = await sb().from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const code = form.code.trim().toUpperCase();
    const value = parseFloat(form.discount_value);
    if (!code || !value || value <= 0) {
      toast({ title: "Completá el código y el valor del descuento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await sb().from("coupons").insert({
        code,
        discount_type: form.discount_type,
        discount_value: value,
        min_order: form.min_order ? parseFloat(form.min_order) : null,
        valid_until: form.valid_until ? new Date(form.valid_until + "T23:59:59").toISOString() : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      });
      if (error) throw error;
      toast({ title: "Cupón creado" });
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      const dup = (e?.message || "").includes("duplicate");
      toast({ title: "No se pudo crear", description: dup ? "Ese código ya existe" : e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    await sb().from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };
  const remove = async (id: string) => {
    await sb().from("coupons").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" /> Cupones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cupones.</p>
          ) : (
            coupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.code}</span>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.discount_type === "percent" ? `${c.discount_value}% OFF` : `${money(c.discount_value)} OFF`}
                    {c.min_order ? ` · mín ${money(c.min_order)}` : ""}
                    {c.valid_until ? ` · hasta ${new Date(c.valid_until).toLocaleDateString("es-AR")}` : ""}
                    {c.max_uses != null ? ` · ${c.uses_count}/${c.max_uses} usos` : ` · ${c.uses_count} usos`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo cupón</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LAPACHO10" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="percent">Porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{form.discount_type === "percent" ? "Descuento (%)" : "Descuento ($)"}</Label>
              <Input
                type="number"
                min="0"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                placeholder={form.discount_type === "percent" ? "10" : "1000"}
              />
            </div>
            <div className="space-y-1">
              <Label>Mínimo de compra ($, opcional)</Label>
              <Input type="number" min="0" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="Sin mínimo" />
            </div>
            <div className="space-y-1">
              <Label>Vence (opcional)</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Usos máximos (opcional)</Label>
              <Input type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Sin límite" />
            </div>
          </div>
          <Button onClick={create} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Crear cupón
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
