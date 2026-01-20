import { useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, Package, XCircle, CreditCard, MessageCircle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVendorNotifications, VendorNotification } from '@/hooks/useVendorNotifications';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  vendorId: string;
}

export function NotificationCenter({ vendorId }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    soundEnabled,
    setSoundEnabled
  } = useVendorNotifications(vendorId);
  
  const { permission, requestPermission, isSupported } = useNotificationPermission();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification: VendorNotification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Could navigate to specific order here based on notification.data
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return <Package className="h-4 w-4 text-primary" />;
      case 'order_cancelled':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'payment_received':
        return <CreditCard className="h-4 w-4 text-primary" />;
      case 'customer_message':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {soundEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setSoundEnabled(!soundEnabled);
              }}
              title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Leer todo
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Permission request banner */}
        {isSupported && permission === 'default' && (
          <>
            <div className="px-3 py-2 bg-muted/50 text-sm">
              <p className="text-muted-foreground mb-2">
                Activa las notificaciones para recibir alertas incluso cuando el navegador esté en segundo plano.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={async (e) => {
                  e.stopPropagation();
                  await requestPermission();
                }}
              >
                <Bell className="h-3 w-3 mr-1" />
                Activar notificaciones
              </Button>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        {permission === 'denied' && (
          <>
            <div className="px-3 py-2 bg-destructive/10 text-sm text-destructive">
              Las notificaciones están bloqueadas. Habilítalas desde la configuración del navegador.
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  !notification.is_read && "bg-primary/5"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                      "text-sm truncate",
                      !notification.is_read && "font-semibold"
                    )}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: es
                    })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
