import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Truck, User, Wallet, Receipt, Banknote, Landmark, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useCart } from "@/hooks/useCart";
import { useAddresses } from "@/hooks/useAddresses";
import { cn } from "@/lib/utils";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
type Payment = "efectivo" | "transferencia" | "mercadopago";
const PAYMENT_LABEL: Record<Payment, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "MercadoPago",
};
const PAYMENT_ICON: Record<Payment, typeof Wallet> = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercadopago: Wallet,
};

interface VendorConfig {
  address: string | null;
  allows_pickup: boolean | null;
  allows_delivery: boolean | null;
  delivery_fixed_price: number | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  accepts_mercadopago: boolean | null;
}

export default function Checkout() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const { toast } = useToast();
  const { cart, subtotal, count, clear } = useCart();

  const [vendor, setVendor] = useState<VendorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { addresses, addAddress } = useAddresses();
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [saveNew, setSaveNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<Payment | "">("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  useEffect(() => {
    if (count === 0 || !cart.vendor_id) {
      navigate(localePath("/tienda"), { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("public_vendors")
        .select("address, allows_pickup, allows_delivery, delivery_fixed_price, accepts_cash, accepts_transfer, accepts_mercadopago")
        .eq("id", cart.vendor_id)
        .maybeSingle();
      if (data) {
        const v = data as VendorConfig;
        setVendor(v);
        if (!v.allows_delivery && v.allows_pickup) setDeliveryType("pickup");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.vendor_id]);

  // Preseleccionar la dirección principal guardada.
  useEffect(() => {
    if (addresses.length > 0 && selectedAddrId === null && !addingNew) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      setSelectedAddrId(def.id);
    }
  }, [addresses, selectedAddrId, addingNew]);

  const chosenAddress = selectedAddrId ? addresses.find((a) => a.id === selectedAddrId) ?? null : null;
  const effectiveAddress =
    deliveryType === "delivery" ? (chosenAddress ? chosenAddress.address : address.trim()) : "";

  const paymentMethods = useMemo<Payment[]>(() => {
    const list: Payment[] = [];
    if (vendor?.accepts_cash) list.push("efectivo");
    if (vendor?.accepts_transfer) list.push("transferencia");
    if (vendor?.accepts_mercadopago) list.push("mercadopago");
    return list;
  }, [vendor]);

  const deliveryCost = deliveryType === "pickup" ? 0 : Math.round(vendor?.delivery_fixed_price ?? 0);
  const discount = appliedCoupon?.discount ?? 0;
  const total = subtotal - discount + deliveryCost;
  const canPickup = !!vendor?.allows_pickup;
  const canDelivery = vendor?.allows_delivery !== false;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true);
    try {
      const { data } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) {
        setAppliedCoupon(null);
        toast({ title: "Cupón inválido", variant: "destructive" });
        return;
      }
      if (data.valid_until && new Date(data.valid_until).getTime() < Date.now()) {
        setAppliedCoupon(null);
        toast({ title: "El cupón venció", variant: "destructive" });
        return;
      }
      if (data.min_order != null && subtotal < Number(data.min_order)) {
        setAppliedCoupon(null);
        toast({ title: `Requiere un mínimo de ${money(Number(data.min_order))}`, variant: "destructive" });
        return;
      }
      if (data.max_uses != null && data.uses_count >= data.max_uses) {
        setAppliedCoupon(null);
        toast({ title: "El cupón ya no está disponible", variant: "destructive" });
        return;
      }
      const disc =
        data.discount_type === "percent"
          ? Math.round((subtotal * Number(data.discount_value)) / 100)
          : Math.round(Number(data.discount_value));
      const finalDisc = Math.min(disc, subtotal);
      setAppliedCoupon({ code, discount: finalDisc });
      toast({ title: "Cupón aplicado", description: `Descuento de ${money(finalDisc)}` });
    } finally {
      setCouponChecking(false);
    }
  };

  const submit = async () => {
    if (!cart.vendor_id) return;
    if (deliveryType === "delivery" && effectiveAddress.length < 4) {
      toast({ title: "Ingresá una dirección de entrega", variant: "destructive" });
      return;
    }
    if (phone.replace(/\D/g, "").length < 6) {
      toast({ title: "Ingresá un teléfono de contacto válido", variant: "destructive" });
      return;
    }
    if (!payment) {
      toast({ title: "Elegí un método de pago", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Login obligatorio: el pedido queda atado a una cuenta real (no invitado).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session || sessionData.session.user.is_anonymous) {
        toast({ title: "Iniciá sesión para confirmar el pedido", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("crear-pedido", {
        body: {
          vendor_id: cart.vendor_id,
          items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          delivery_type: deliveryType,
          address: deliveryType === "delivery" ? effectiveAddress : undefined,
          payment_method: payment,
          customer_name: name.trim() || undefined,
          customer_phone: phone.trim(),
          notes: notes.trim() || undefined,
          coupon_code: appliedCoupon?.code,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.coupon_error) setAppliedCoupon(null);
        toast({
          title: "No se pudo crear el pedido",
          description: data.stock_issues?.join(" · ") || data.error,
          variant: "destructive",
        });
        return;
      }

      clear();

      // Guardar la dirección nueva para la próxima (si el cliente lo pidió).
      if (deliveryType === "delivery" && !chosenAddress && saveNew && effectiveAddress.length >= 4) {
        try {
          await addAddress({ address: effectiveAddress });
        } catch (e) {
          console.error("No se pudo guardar la dirección:", e);
        }
      }

      if (data?.payment_link) {
        window.location.href = data.payment_link as string;
        return;
      }
      navigate(localePath(`/pedido/${data.order_id}`), {
        replace: true,
        state: { transfer: data.transfer_data ?? null },
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error al crear el pedido", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <button onClick={() => navigate(localePath("/carrito"))} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al carrito
      </button>
      <h1 className="text-xl font-bold">Confirmar pedido</h1>

      {/* Entrega */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary" /> Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {canDelivery && (
              <Button
                type="button"
                variant={deliveryType === "delivery" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDeliveryType("delivery")}
              >
                Delivery
              </Button>
            )}
            {canPickup && (
              <Button
                type="button"
                variant={deliveryType === "pickup" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDeliveryType("pickup")}
              >
                Retiro en local
              </Button>
            )}
          </div>
          {deliveryType === "delivery" ? (
            <div className="space-y-3">
              {addresses.length > 0 && (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAddrId(a.id);
                        setAddingNew(false);
                      }}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition",
                        selectedAddrId === a.id && !addingNew ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.label || "Dirección"}</span>
                        {a.is_default && (
                          <Badge variant="secondary" className="text-[11px]">Principal</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.address}</p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNew(true);
                      setSelectedAddrId(null);
                    }}
                    className={cn(
                      "w-full rounded-lg border border-dashed p-3 text-left text-sm transition",
                      addingNew ? "border-primary text-foreground" : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    + Usar otra dirección
                  </button>
                </div>
              )}

              {(addingNew || addresses.length === 0) && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="address">Dirección de entrega</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle y número (depto, piso, referencia)"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={saveNew}
                      onChange={(e) => setSaveNew(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                    />
                    Guardar esta dirección para la próxima
                  </label>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Retirás en: {vendor?.address}</p>
          )}
        </CardContent>
      </Card>

      {/* Datos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Tus datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="phone">Teléfono de contacto</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3464 55-5555" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Nombre (opcional)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te llamás" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Aclaraciones (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: timbre roto (golpear), dejar en portería, sin sal…"
              rows={2}
              maxLength={300}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pago */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este negocio no tiene métodos de pago configurados.</p>
          ) : (
            paymentMethods.map((m) => {
              const Icon = PAYMENT_ICON[m];
              return (
                <Button
                  key={m}
                  type="button"
                  variant={payment === m ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  onClick={() => setPayment(m)}
                >
                  <Icon className="h-4 w-4" /> {PAYMENT_LABEL[m]}
                </Button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Cupón */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4 text-primary" /> Cupón
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appliedCoupon ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
                Cupón <b>{appliedCoupon.code}</b> aplicado (−{money(appliedCoupon.discount)})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAppliedCoupon(null);
                  setCouponInput("");
                }}
              >
                Quitar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Código de descuento"
              />
              <Button variant="outline" onClick={applyCoupon} disabled={couponChecking || !couponInput.trim()}>
                {couponChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" /> Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {cart.items.map((i) => (
            <div key={i.product_id} className="flex justify-between">
              <span>{i.quantity}× {i.name}</span>
              <span>{money(i.price * i.quantity)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Descuento {appliedCoupon ? `(${appliedCoupon.code})` : ""}</span>
              <span>-{money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Envío</span>
            <span>{deliveryType === "pickup" ? "Gratis" : money(deliveryCost)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span><span>{money(total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Confirmar fijo abajo */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button className="w-full" size="lg" disabled={submitting || paymentMethods.length === 0} onClick={submit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar pedido · {money(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}
