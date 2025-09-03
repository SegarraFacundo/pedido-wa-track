import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order, OrderStatus } from "@/types/order";
import { Clock, MapPin, Phone, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  onOpenChat?: (orderId: string) => void;
  isVendorView?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-status-pending text-white" },
  confirmed: { label: "Confirmado", className: "bg-status-confirmed text-white" },
  preparing: { label: "Preparando", className: "bg-status-preparing text-white" },
  ready: { label: "Listo", className: "bg-status-ready text-white" },
  delivering: { label: "En camino", className: "bg-status-delivering text-white" },
  delivered: { label: "Entregado", className: "bg-status-delivered text-white" },
  cancelled: { label: "Cancelado", className: "bg-status-cancelled text-white" },
};

const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
  const flow: Record<OrderStatus, OrderStatus | null> = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
    ready: 'delivering',
    delivering: 'delivered',
    delivered: null,
    cancelled: null,
  };
  return flow[currentStatus];
};

export function OrderCard({ order, onStatusChange, onOpenChat, isVendorView = false }: OrderCardProps) {
  const nextStatus = getNextStatus(order.status);
  
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">Pedido #{order.id.slice(0, 8)}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleString('es-AR')}
            </p>
          </div>
          <Badge className={cn("font-medium", statusConfig[order.status].className)}>
            {statusConfig[order.status].label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{isVendorView && order.customerNameMasked ? order.customerNameMasked : order.customerName}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{isVendorView && order.customerPhoneMasked ? order.customerPhoneMasked : order.customerPhone}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="line-clamp-1">{isVendorView && order.addressSimplified ? order.addressSimplified : order.address}</span>
          </div>
          
          {order.estimatedDelivery && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Entrega estimada: {new Date(order.estimatedDelivery).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
        
        <div className="border-t pt-3">
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t font-semibold">
            <span>Total</span>
            <span className="text-primary">${order.total.toFixed(2)}</span>
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
          
          {isVendorView && nextStatus && order.status !== 'delivered' && order.status !== 'cancelled' && (
            <Button
              size="sm"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              onClick={() => onStatusChange?.(order.id, nextStatus)}
            >
              Marcar como {statusConfig[nextStatus].label}
            </Button>
          )}
          
          {order.status === 'pending' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onStatusChange?.(order.id, 'cancelled')}
            >
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}