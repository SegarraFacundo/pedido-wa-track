import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Bell, Check, Clock, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { enablePushNotifications } from "@/lib/push";
import { OrderChat } from "@/components/customer/OrderChat";
import { cn } from "@/lib/utils";

const CANCELABLE = ["pending", "confirmed", "preparing"];

const STATUS_MSG: Record<string, string> = {
  confirmed: "Tu pedido fue confirmado ✅",
  preparing: "Tu pedido se está preparando 👨‍🍳",
  ready: "Tu pedido está listo 🎉",
  delivering: "Tu pedido va en camino 🛵",
  delivered: "Tu pedido fue entregado. ¡Que lo disfrutes! 😋",
  cancelled: "Tu pedido fue cancelado",
};

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${label} ${n}`}>
            <Star className={cn("h-6 w-6", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>
    </div>
  );
}

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

const STEPS = [
  { key: "pending", label: "Recibido" },
  { key: "confirmed", label: "Confirmado" },
  { key: "preparing", label: "En preparación" },
  { key: "ready", label: "Listo" },
  { key: "delivered", label: "Entregado" },
];

interface OrderRow {
  id: string;
  status: string;
  total: number;
  address: string;
  payment_method: string | null;
  payment_status: string | null;
  delivery_type: string | null;
  estimated_delivery: string | null;
  discount: number | null;
  coupon_code: string | null;
  items: any;
  vendor_id: string;
  vendors?: { name: string } | null;
}

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const localePath = useLocalePath();
  const [order, setOrder] = useState<OrderRow | null>(null);
  // Datos de transferencia: llegan por navegación desde el checkout (no se leen de vendors,
  // que está restringida). Se pierden si recargás la página (fallback: coordinar con el negocio).
  const transfer = (location.state as any)?.transfer as { alias?: string; cbu?: string; titular?: string } | null;
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { permission, showNotification } = useNotificationPermission();

  // Notificador estable (evita closures viejos en la suscripción realtime).
  const notifyRef = useRef<(status: string) => void>(() => {});
  notifyRef.current = (status: string) => {
    const msg = STATUS_MSG[status];
    if (!msg) return;
    toast({ title: "Actualización de tu pedido", description: msg });
    showNotification("Lapacho", { body: msg, data: { url: window.location.pathname } });
  };

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [rDelivery, setRDelivery] = useState(0);
  const [rService, setRService] = useState(0);
  const [rProduct, setRProduct] = useState(0);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  const activarPush = async () => {
    const r = await enablePushNotifications();
    if (r === "granted") {
      setPushDone(true);
      toast({ title: "Notificaciones activadas", description: "Te avisamos cuando cambie tu pedido." });
    } else if (r === "denied") {
      toast({ title: "Permiso denegado", description: "Habilitá las notificaciones en el navegador.", variant: "destructive" });
    } else if (r === "unsupported") {
      toast({ title: "Tu navegador no soporta notificaciones", variant: "destructive" });
    } else {
      toast({ title: "No se pudieron activar", variant: "destructive" });
    }
  };

  const doCancel = async () => {
    if (!orderId) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancelar-pedido", {
        body: { order_id: orderId, reason: reason.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "No se pudo cancelar", description: data.error, variant: "destructive" });
        return;
      }
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setCancelOpen(false);
      toast({ title: "Pedido cancelado" });
    } catch (e: any) {
      toast({ title: "Error al cancelar", description: e?.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const doRate = async () => {
    if (!orderId) return;
    if (!rDelivery && !rService && !rProduct && !comment.trim()) {
      toast({ title: "Dejá al menos una estrella o un comentario", variant: "destructive" });
      return;
    }
    setRating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calificar-pedido", {
        body: {
          order_id: orderId,
          delivery_rating: rDelivery || undefined,
          service_rating: rService || undefined,
          product_rating: rProduct || undefined,
          comment: comment.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.already_reviewed) setRated(true);
        toast({ title: "No se pudo calificar", description: data.error, variant: "destructive" });
        return;
      }
      setRated(true);
      toast({ title: "¡Gracias por tu calificación!" });
    } catch (e: any) {
      toast({ title: "Error al calificar", description: e?.message, variant: "destructive" });
    } finally {
      setRating(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    let channel: any;

    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total, address, payment_method, payment_status, delivery_type, estimated_delivery, discount, coupon_code, items, vendor_id, vendors(name)")
        .eq("id", orderId)
        .maybeSingle();
      setOrder((data as OrderRow) ?? null);
      setLoading(false);
    };

    load();

    channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) =>
          setOrder((prev) => {
            const next = prev ? { ...prev, ...(payload.new as OrderRow) } : prev;
            if (prev && next && prev.status !== next.status) notifyRef.current(next.status);
            return next;
          }),
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No encontramos este pedido.</p>
        <Button variant="link" onClick={() => navigate(localePath("/tienda"))}>
          Volver a la tienda
        </Button>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const items: Array<{ name: string; quantity: number; price: number }> = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
        {order.vendors?.name && <p className="text-sm text-muted-foreground">{order.vendors.name}</p>}
      </div>

      {cancelled ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4">
            <Badge variant="destructive">Cancelado</Badge>
            <span className="text-sm text-muted-foreground">Este pedido fue cancelado.</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Estado actual, destacado */}
          <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-5 text-center text-primary-foreground shadow-md">
            <p className="text-lg font-semibold">{STATUS_MSG[order.status] ?? "Tu pedido está en proceso"}</p>
          </div>

          {order.estimated_delivery && order.status !== "delivered" && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Entrega estimada: ~
              {new Date(order.estimated_delivery).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Línea de tiempo del pedido */}
          <Card>
            <CardContent className="p-4">
              {STEPS.map((step, idx) => {
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                const isLast = idx === STEPS.length - 1;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                          done ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      {!isLast && (
                        <div className={cn("min-h-[1.5rem] w-0.5 flex-1", idx < currentIdx ? "bg-primary" : "bg-muted")} />
                      )}
                    </div>
                    <span
                      className={cn(
                        "pb-6 text-sm",
                        active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {permission !== "denied" && !pushDone && !cancelled && order.status !== "delivered" && (
        <Button variant="secondary" className="w-full" onClick={activarPush}>
          <Bell className="mr-2 h-4 w-4" /> Activar notificaciones del pedido
        </Button>
      )}

      {!cancelled && CANCELABLE.includes(order.status) && (
        <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
          Cancelar pedido
        </Button>
      )}

      {order.status === "delivered" && !rated && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">¿Cómo estuvo tu pedido?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StarRow label="Entrega" value={rDelivery} onChange={setRDelivery} />
            <StarRow label="Atención" value={rService} onChange={setRService} />
            <StarRow label="Producto" value={rProduct} onChange={setRProduct} />
            <Textarea
              placeholder="Dejá un comentario (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            <Button className="w-full" onClick={doRate} disabled={rating}>
              {rating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar calificación
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status === "delivered" && rated && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            ¡Gracias por tu calificación! ⭐
          </CardContent>
        </Card>
      )}

      {transfer && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos para transferir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {transfer.alias && <div><b>Alias:</b> {transfer.alias}</div>}
            {transfer.cbu && <div><b>CBU/CVU:</b> {transfer.cbu}</div>}
            {transfer.titular && <div><b>Titular:</b> {transfer.titular}</div>}
            <p className="pt-1 text-muted-foreground">Enviá el comprobante al negocio para confirmar el pedido.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {items.map((i, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{i.quantity}× {i.name}</span>
              <span>{money(i.price * i.quantity)}</span>
            </div>
          ))}
          {order.discount ? (
            <div className="flex justify-between text-primary">
              <span>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>-{money(order.discount)}</span>
            </div>
          ) : null}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold"><span>Total</span><span>{money(order.total)}</span></div>
          <div className="pt-2 text-muted-foreground">
            {order.delivery_type === "pickup" ? "Retiro en local" : `Envío a: ${order.address}`}
          </div>
          <div className="text-muted-foreground">Pago: {order.payment_method}</div>
        </CardContent>
      </Card>

      <OrderChat orderId={order.id} vendorId={order.vendor_id} />

      <Button variant="outline" className="w-full" onClick={() => navigate(localePath("/tienda"))}>
        Volver a la tienda
      </Button>

      <AlertDialog open={cancelOpen} onOpenChange={(o) => !o && setCancelOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Contanos el motivo para que el negocio lo sepa. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo de la cancelación"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (reason.trim().length < 3) {
                  toast({ title: "Escribí un motivo", variant: "destructive" });
                  return;
                }
                doCancel();
              }}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
