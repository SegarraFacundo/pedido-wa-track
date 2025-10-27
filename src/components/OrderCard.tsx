import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order, OrderItem, OrderStatus } from "@/types/order";
import { Image, FileText, Clock, MapPin, Phone, User, MessageCircle } from "lucide-react";
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
  
  // Debug logging
  console.log('OrderCard - order.items:', order.items);
  console.log('OrderCard - items length:', order.items?.length);
  
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
          <div className="mb-2">
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Productos:</h4>
            <div className="space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, index) => (
                  <div key={item.id || index} className="bg-muted/30 p-2 rounded-md">
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
                        <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right mt-1">
                      <p className="font-semibold text-sm">${(item.price * item.quantity).toFixed(2)}</p>
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
          
          {/* Comprobante de pago */}
          {isVendorView && order.payment_receipt_url && (
            <div className="mt-3 pt-3 border-t">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Comprobante de Pago
              </h4>
              <a 
                href={order.payment_receipt_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
              >
                <Image className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">Ver comprobante</span>
              </a>
              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                <Button
                  size="sm"
                  className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    // TODO: Agregar lógica para marcar como pagado
                    console.log('Marcar como pagado:', order.id);
                  }}
                >
                  ✓ Confirmar pago recibido
                </Button>
              )}
            </div>
          )}
          
          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Total</span>
            <span className="text-primary text-lg">${order.total.toFixed(2)}</span>
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
          
          <Button
              size="sm"
              variant="destructive"
              onClick={() => onStatusChange?.(order.id, 'cancelled')}
            >
              Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}