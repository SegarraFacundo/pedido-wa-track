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
import { Bike, Plus, Loader2 } from "lucide-react";

// couriers todavía no está en los tipos generados de Supabase.
const sb = () => supabase as any;
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  payout_fee: number;
  is_active: boolean;
  is_online: boolean;
}

const EMPTY = { name: "", email: "", password: "", phone: "", vehicle: "moto", payout_fee: "", monotributo_cuit: "" };

export default function CouriersManager() {
  const { toast } = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const { data } = await sb().from("couriers").select("*").order("created_at", { ascending: false });
    setCouriers((data as Courier[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      toast({ title: "Completá nombre, email y una contraseña (mín. 6)", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-repartidor-user", {
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          vehicle: form.vehicle,
          payout_fee: form.payout_fee ? parseFloat(form.payout_fee) : 0,
          monotributo_cuit: form.monotributo_cuit.trim() || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Repartidor creado" });
      setForm(EMPTY);
      load();
    } catch (e: any) {
      toast({ title: "No se pudo crear", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Courier) => {
    await sb().from("couriers").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const saveFee = async (c: Courier, value: string) => {
    const fee = parseFloat(value);
    if (isNaN(fee) || fee < 0) return;
    await sb().from("couriers").update({ payout_fee: fee }).eq("id", c.id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" /> Repartidores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : couriers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay repartidores.</p>
          ) : (
            couriers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge>
                    {c.is_online && <Badge variant="outline" className="text-[11px]">En línea</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.vehicle ?? ""} {c.phone ? `· ${c.phone}` : ""}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Tarifa/envío</Label>
                    <Input
                      type="number"
                      defaultValue={c.payout_fee}
                      onBlur={(e) => saveFee(c, e.target.value)}
                      className="h-7 w-24 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{money(c.payout_fee)}</span>
                  </div>
                </div>
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo repartidor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1">
              <Label>Vehículo</Label>
              <Select value={form.vehicle} onValueChange={(v) => setForm({ ...form, vehicle: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="bici">Bici</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Email (para ingresar)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="repartidor@lapacho.ar" />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 3464 ..." />
            </div>
            <div className="space-y-1">
              <Label>Tarifa por envío ($)</Label>
              <Input type="number" value={form.payout_fee} onChange={(e) => setForm({ ...form, payout_fee: e.target.value })} placeholder="800" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>CUIT monotributo (opcional)</Label>
              <Input value={form.monotributo_cuit} onChange={(e) => setForm({ ...form, monotributo_cuit: e.target.value })} placeholder="20-12345678-9" />
            </div>
          </div>
          <Button onClick={create} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Crear repartidor
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
