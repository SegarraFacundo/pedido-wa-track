import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order, OrderItem, OrderStatus } from "@/types/order";
import {
  Image,
  FileText,
  Clock,
  MapPin,
  Phone,
  User,
  MessageCircle,
  DollarSign,
  CheckCircle,
  XCircle,
  CreditCard,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { OrderCancellationDialog } from "./OrderCancellationDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canMarkAsPaid, canMarkAsUnpaid } from "@/lib/paymentValidation";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  onOpenChat?: (orderId: string) => void;
  isVendorView?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> =
  {
    pending: { label: "Pendiente", className: "bg-status-pending text-white" },
    confirmed: {
      label: "Confirmado",
      className: "bg-status-confirmed text-white",
    },
    preparing: {
      label: "Preparando",
      className: "bg-status-preparing text-white",
    },
    ready: { label: "Listo", className: "bg-status-ready text-white" },
    delivering: {
      label: "En camino",
      className: "bg-status-delivering text-white",
    },
    delivered: {
      label: "Entregado",
      className: "bg-status-delivered text-white",
    },
    cancelled: {
      label: "Cancelado",
      className: "bg-status-cancelled text-white",
    },
  };

const getNextStatus = (
  currentStatus: OrderStatus,
  deliveryType?: "delivery" | "pickup",
): OrderStatus | null => {
  // Para retiro en local: saltar "delivering"
  if (deliveryType === "pickup") {
    const pickupFlow: Record<OrderStatus, OrderStatus | null> = {
      pending: "confirmed",
      confirmed: "preparing",
      preparing: "ready",
      ready: "delivered", // ⭐ Salta directamente a entregado
      delivering: "delivered",
      delivered: null,
      cancelled: null,
    };
    return pickupFlow[currentStatus];
  }

  // Flujo normal para delivery
  const flow: Record<OrderStatus, OrderStatus | null> = {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "delivering",
    delivering: "delivered",
    delivered: null,
    cancelled: null,
  };
  return flow[currentStatus];
};

export function OrderCard({
  order,
  onStatusChange,
  onOpenChat,
  isVendorView = false,
}: OrderCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const nextStatus = getNextStatus(order.status, order.delivery_type);

  const handleMarkAsPaid = async () => {
    // Validar si se puede marcar como pagado
    const validation = canMarkAsPaid(
      order.status,
      order.payment_method || "efectivo",
    );

    if (!validation.allowed) {
      toast.error(
        validation.reason || "No se puede marcar como pagado en este momento",
      );
      return;
    }

    try {
      setIsUpdatingPayment(true);
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      // Add to status history
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: "payment_confirmed",
        changed_by: "vendor",
        reason: `Pago confirmado por el vendedor (${order.payment_method || "efectivo"})`,
      });

      // Enviar notificación al cliente
      try {
        await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            orderId: order.id,
            phoneNumber: order.customerPhone,
            message: `✅ ¡Tu pago ha sido confirmado!\n\nPedido: #${order.id.slice(0, 8)}\nEstado: ${statusConfig[order.status].label}\n\n¡Gracias por tu compra! 😊`,
          },
        });
      } catch (notifyError) {
        console.error("Error sending notification:", notifyError);
      }

      toast.success("Pago marcado como recibido");
      window.location.reload();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Error al actualizar el estado de pago");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleMarkAsUnpaid = async () => {
    try {
      setIsUpdatingPayment(true);
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "pending",
          paid_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      // Enviar notificación al cliente
      try {
        await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            orderId: order.id,
            phoneNumber: order.customerPhone,
            message: `⚠️ Hay un problema con tu pago\n\nPedido: #${order.id.slice(0, 8)}\n\nPor favor, verificá tu comprobante de pago o contactá con nosotros. 📞`,
          },
        });
      } catch (notifyError) {
        console.error("Error sending notification:", notifyError);
      }

      toast.success("Pago marcado como pendiente");
      window.location.reload();
    } catch (error) {
      console.error("Error marking as unpaid:", error);
      toast.error("Error al actualizar el estado de pago");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const paymentStatus = order.payment_status || "pending";
  const paymentMethod = order.payment_method || "No especificado";

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              Pedido #{order.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge
              className={cn(
                "font-medium",
                statusConfig[order.status].className,
              )}
            >
              {statusConfig[order.status].label}
            </Badge>
            {/* ⭐ Badge para tipo de entrega */}
            {order.delivery_type === "pickup" ? (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
              >
                🏪 Retiro en Local
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800"
              >
                🚚 Delivery
              </Badge>
            )}
            {isVendorView && (
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  paymentStatus === "paid"
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
                )}
              >
                {paymentStatus === "paid" ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Pagado
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    No pagado
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>
              {isVendorView && order.customerNameMasked
                ? order.customerNameMasked
                : order.customerName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>
              {isVendorView && order.customerPhoneMasked
                ? order.customerPhoneMasked
                : order.customerPhone}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="line-clamp-1">
              {isVendorView && order.addressSimplified
                ? order.addressSimplified
                : order.address}
            </span>
          </div>

          {/* Alerta de dirección manual - GPS removido del MVP */}

          {order.estimatedDelivery && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                Entrega estimada:{" "}
                {new Date(order.estimatedDelivery).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="mb-2">
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">
              Productos:
            </h4>
            <div className="space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="bg-muted/30 p-2 rounded-md"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Nota: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-medium">{item.quantity}x</p>
                        <p className="text-sm text-muted-foreground">
                          ${item.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right mt-1">
                      <p className="font-semibold text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded-md">
                  {order.items && order.items.length}x - Detalles no disponibles
                </div>
              )}
            </div>
          </div>

          {/* Información de pago */}
          {isVendorView && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Método de pago:</span>
                </div>
                <span className="text-sm font-semibold capitalize">
                  {paymentMethod}
                </span>
              </div>

              {/* Comprobante - Mostrar siempre para transferencia */}
              {(paymentMethod === "transferencia" ||
                paymentMethod === "mercadopago") && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Comprobante de Pago
                  </h4>
                  {order.payment_receipt_url ? (
                    <a
                      href={order.payment_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                    >
                      <Image className="h-5 w-5 text-primary" />
                      <span className="text-sm text-primary font-medium">
                        Ver comprobante
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                      <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-amber-700 dark:text-amber-300">
                        El cliente aún no envió el comprobante
                      </span>
                    </div>
                  )}
                </div>
              )}

              {order.status !== "cancelled" && (
                <div className="flex flex-col gap-2">
                  {paymentStatus !== "paid" &&
                    canMarkAsPaid(
                      order.status,
                      order.payment_method || "efectivo",
                    ).allowed && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleMarkAsPaid}
                        disabled={isUpdatingPayment}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Marcar como pagado
                      </Button>
                    )}

                  {paymentStatus !== "paid" &&
                    !canMarkAsPaid(
                      order.status,
                      order.payment_method || "efectivo",
                    ).allowed && (
                      <Badge variant="secondary" className="text-xs py-2 px-3">
                        {
                          canMarkAsPaid(
                            order.status,
                            order.payment_method || "efectivo",
                          ).reason
                        }
                      </Badge>
                    )}

                  {paymentStatus === "paid" &&
                    canMarkAsUnpaid(
                      order.status,
                      order.payment_method || "efectivo",
                    ).allowed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={handleMarkAsUnpaid}
                        disabled={isUpdatingPayment}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Marcar como no pagado
                      </Button>
                    )}

                  {paymentStatus === "paid" &&
                    !canMarkAsUnpaid(
                      order.status,
                      order.payment_method || "efectivo",
                    ).allowed && (
                      <Badge
                        variant="secondary"
                        className="text-xs py-2 px-3 flex items-center gap-1"
                      >
                        <Lock className="h-3 w-3" />
                        Pago confirmado - No modificable
                      </Badge>
                    )}
                </div>
              )}

              {paymentStatus === "paid" && order.paid_at && (
                <p className="text-xs text-muted-foreground">
                  Pagado: {new Date(order.paid_at).toLocaleString("es-AR")}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Total</span>
            <span className="text-primary text-lg">
              ${order.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onOpenChat?.(order.id)}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Chat
          </Button>

          {isVendorView &&
            nextStatus &&
            order.status !== "delivered" &&
            order.status !== "cancelled" && (
              <Button
                size="sm"
                className="flex-1 bg-gradient-primary hover:opacity-90"
                onClick={() => onStatusChange?.(order.id, nextStatus)}
              >
                Marcar como {statusConfig[nextStatus].label}
              </Button>
            )}

          {order.status !== "delivered" && order.status !== "cancelled" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>

      <OrderCancellationDialog
        orderId={order.id}
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onSuccess={() => window.location.reload()}
        isVendor={isVendorView}
      />
    </Card>
  );
}
