import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Order } from "@/types/order";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Phone, Package, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface OrderTrackingProps {
  order: Order;
}

const trackingSteps = [
  { status: 'confirmed', label: 'Confirmado', icon: CheckCircle2 },
  { status: 'preparing', label: 'Preparando', icon: Package },
  { status: 'ready', label: 'Listo', icon: CheckCircle2 },
  { status: 'delivering', label: 'En camino', icon: MapPin },
  { status: 'delivered', label: 'Entregado', icon: CheckCircle2 },
];

export function OrderTracking({ order }: OrderTrackingProps) {
  const [mapUrl, setMapUrl] = useState("");
  
  useEffect(() => {
    if (order.coordinates) {
      setMapUrl(`https://maps.googleapis.com/maps/api/staticmap?center=${order.coordinates.lat},${order.coordinates.lng}&zoom=15&size=600x300&markers=${order.coordinates.lat},${order.coordinates.lng}&key=YOUR_API_KEY`);
    }
  }, [order.coordinates]);
  
  const getCurrentStepIndex = () => {
    const index = trackingSteps.findIndex(step => step.status === order.status);
    return index >= 0 ? index : -1;
  };
  
  const currentStepIndex = getCurrentStepIndex();
  
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-hero text-white">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Pedido #{order.id.slice(0, 8)}</CardTitle>
              <p className="text-white/90 mt-1">{order.vendorName}</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur">
              {order.status === 'delivered' ? '✓ Entregado' : 'En proceso'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {/* Progress Tracker */}
          <div className="relative mb-8">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-muted -translate-y-1/2" />
            <div 
              className="absolute left-0 top-1/2 h-1 bg-gradient-primary -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(currentStepIndex / (trackingSteps.length - 1)) * 100}%` }}
            />
            
            <div className="relative flex justify-between">
              {trackingSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                
                return (
                  <div
                    key={step.status}
                    className="flex flex-col items-center"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                        isActive ? "bg-gradient-primary text-white shadow-glow" : "bg-muted text-muted-foreground",
                        isCurrent && "animate-pulse-glow scale-110"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn(
                      "text-xs mt-2 text-center",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Order Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Detalles del pedido</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Dirección de entrega</p>
                    <p className="text-sm text-muted-foreground">{order.address}</p>
                  </div>
                </div>
                
                {order.estimatedDelivery && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Tiempo estimado</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.estimatedDelivery).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}
                
                {order.deliveryPersonName && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Repartidor</p>
                      <p className="text-sm text-muted-foreground">{order.deliveryPersonName}</p>
                      <p className="text-sm text-muted-foreground">{order.deliveryPersonPhone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumen del pedido</h3>
              
              <div className="space-y-2 border rounded-lg p-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Map Placeholder */}
          {order.status === 'delivering' && (
            <div className="mt-6">
              <h3 className="font-semibold text-lg mb-3">Seguimiento en tiempo real</h3>
              <div className="bg-gradient-subtle rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-primary mx-auto mb-2 animate-pulse" />
                  <p className="text-muted-foreground">Mapa de seguimiento en vivo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tu pedido está en camino
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}