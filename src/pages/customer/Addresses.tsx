import { useState } from "react";
import { MapPin, Trash2, Star, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAddresses } from "@/hooks/useAddresses";

export default function Addresses() {
  const { toast } = useToast();
  const { addresses, loading, addAddress, setDefault, removeAddress } = useAddresses();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (address.trim().length < 4) {
      toast({ title: "Ingresá una dirección válida", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addAddress({ address, label: label || null });
      setLabel("");
      setAddress("");
      toast({ title: "Dirección guardada" });
    } catch (e) {
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mis direcciones</h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no guardaste ninguna dirección.</p>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start gap-3 p-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.label || "Dirección"}</span>
                    {a.is_default && <Badge variant="secondary" className="text-[11px]">Principal</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{a.address}</p>
                  {!a.is_default && (
                    <button
                      onClick={() => setDefault(a.id)}
                      className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Star className="h-3 w-3" /> Hacer principal
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeAddress(a.id)}
                  aria-label="Borrar dirección"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Agregar dirección</h2>
          <div className="space-y-1">
            <Label htmlFor="label">Nombre (opcional)</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Casa, Trabajo" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="addr">Dirección</Label>
            <Input
              id="addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle y número (depto, piso, referencia)"
            />
          </div>
          <Button onClick={handleAdd} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Guardar dirección
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
