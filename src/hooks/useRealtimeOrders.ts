import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus } from '@/types/order';
import { useToast } from '@/hooks/use-toast';
import { formatOrder } from '@/lib/order-utils';

export function useRealtimeOrders(vendorId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let channel: any;

    const fetchOrders = async () => {
      try {
        let query = supabase
          .from('orders')
          .select(`
            *,
            vendor:vendors(*)
          `)
          .order('created_at', { ascending: false });

        if (vendorId) {
          query = query.eq('vendor_id', vendorId);
        }

        const { data, error } = await query;

        if (error) throw error;

        setOrders(data?.map(formatOrder) || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toastRef.current({
          title: 'Error',
          description: 'No se pudieron cargar los pedidos',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    const setupRealtime = () => {
      channel = supabase
        .channel(`orders-rt-${vendorId || 'all'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            ...(vendorId && { filter: `vendor_id=eq.${vendorId}` })
          },
          async (payload) => {
            console.log('Order change received:', payload);

            if (payload.eventType === 'INSERT') {
              const { data } = await supabase
                .from('orders')
                .select(`*, vendor:vendors(*)`)
                .eq('id', payload.new.id)
                .single();

              if (data) {
                const newOrder = formatOrder(data);

                setOrders(prev => {
                  // Avoid duplicates
                  if (prev.some(o => o.id === newOrder.id)) return prev;
                  return [newOrder, ...prev];
                });

                await supabase.from('vendor_notification_history').insert({
                  vendor_id: newOrder.vendorId,
                  type: 'new_order',
                  title: 'Nuevo Pedido',
                  message: `Pedido #${newOrder.id.slice(0, 8)} - $${newOrder.total.toLocaleString()}`,
                  data: { order_id: newOrder.id, total: newOrder.total }
                });

                toastRef.current({
                  title: '🆕 NUEVO PEDIDO INGRESADO',
                  description: `Pedido #${newOrder.id.slice(0, 8)} - $${newOrder.total.toFixed(2)}`,
                  duration: 10000,
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              const newStatus = payload.new.status as OrderStatus;

              setOrders(prev => {
                const oldOrder = prev.find(o => o.id === payload.new.id);

                // Fire notifications asynchronously based on old state
                if (oldOrder && oldOrder.status !== newStatus) {
                  let notificationType: 'order_cancelled' | 'order_updated' | 'payment_received' = 'order_updated';
                  let title = 'Pedido Actualizado';
                  let message = `Estado cambiado a ${newStatus}`;

                  if (newStatus === 'cancelled') {
                    notificationType = 'order_cancelled';
                    title = 'Pedido Cancelado';
                    message = `El pedido #${payload.new.id.slice(0, 8)} fue cancelado`;
                  }

                  supabase.from('vendor_notification_history').insert({
                    vendor_id: payload.new.vendor_id,
                    type: notificationType,
                    title,
                    message,
                    data: { order_id: payload.new.id, status: newStatus }
                  });
                }

                if (oldOrder && oldOrder.payment_status !== 'paid' && payload.new.payment_status === 'paid') {
                  supabase.from('vendor_notification_history').insert({
                    vendor_id: payload.new.vendor_id,
                    type: 'payment_received',
                    title: 'Pago Recibido',
                    message: `Se recibió el pago del pedido #${payload.new.id.slice(0, 8)}`,
                    data: { order_id: payload.new.id }
                  });
                }

                return prev.map(order =>
                  order.id === payload.new.id
                    ? {
                      ...order,
                      status: newStatus,
                      updatedAt: new Date(payload.new.updated_at),
                      deliveryPersonName: payload.new.delivery_person_name,
                      deliveryPersonPhone: payload.new.delivery_person_phone,
                      notes: payload.new.notes,
                      payment_status: payload.new.payment_status,
                      payment_method: payload.new.payment_method,
                      paid_at: payload.new.paid_at ? new Date(payload.new.paid_at) : undefined
                    }
                    : order
                );
              });

              if (newStatus === 'cancelled') {
                toastRef.current({
                  title: '🚨 PEDIDO CANCELADO POR EL CLIENTE',
                  description: `El pedido #${payload.new.id.slice(0, 8)} fue cancelado`,
                  variant: 'destructive',
                  duration: 15000,
                });
              } else {
                toastRef.current({
                  title: '✅ Pedido actualizado',
                  description: `Estado cambiado a ${newStatus}`,
                });
              }
            } else if (payload.eventType === 'DELETE') {
              setOrders(prev => prev.filter(order => order.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          console.log(`Realtime subscription status for orders: ${status}`);
        });
    };

    fetchOrders();
    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [vendorId]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      // Primero verificar el estado actual EN LA BASE DE DATOS (no local)
      const { data: freshOrder, error: fetchError } = await supabase
        .from('orders')
        .select('status, delivery_type')
        .eq('id', orderId)
        .single();

      if (fetchError || !freshOrder) {
        throw new Error('Pedido no encontrado');
      }

      // Si el pedido ya fue cancelado en la DB, bloquear y sincronizar estado local
      if (freshOrder.status === 'cancelled') {
        setOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, status: 'cancelled' as OrderStatus, updatedAt: new Date() }
            : order
        ));
        toast({
          title: "⚠️ Pedido cancelado",
          description: "Este pedido ya fue cancelado por el cliente. No se puede modificar.",
          variant: "destructive",
        });
        return;
      }

      // Evitar actualizar al mismo estado
      if (freshOrder.status === newStatus) {
        console.log(`Pedido ya está en estado ${newStatus}, ignorando actualización`);
        return;
      }

      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        throw new Error('Pedido no encontrado localmente');
      }

      // Actualizar localmente primero para feedback inmediato
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: newStatus, updatedAt: new Date() }
          : order
      ));

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Notificar al vendedor si el pedido fue cancelado
      if (newStatus === 'cancelled') {
        supabase.functions.invoke('notify-vendor', {
          body: {
            orderId,
            eventType: 'order_cancelled'
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error sending vendor cancellation notification:', error);
          } else {
            console.log('Vendor cancellation notification sent:', data);
          }
        });
      }

      // Send WhatsApp notification to customer (translated)
      const isPickup = currentOrder.delivery_type === 'pickup';
      let notificationType = '';
      let notificationMessage = '';

      if (newStatus === 'confirmed') notificationType = 'status_confirmed';
      else if (newStatus === 'preparing') notificationType = 'status_preparing';
      else if (newStatus === 'ready') notificationType = isPickup ? 'status_ready_pickup' : 'status_ready_delivery';
      else if (newStatus === 'delivering') notificationType = 'status_delivering';
      else if (newStatus === 'cancelled') notificationType = 'status_cancelled';
      else if (newStatus === 'delivered') {
        // For delivered with rating prompt or pickup
        if (isPickup) {
          notificationType = 'delivered_pickup';
        } else {
          notificationType = 'delivered_rating';
        }
      }

      if (notificationType) {
        const { getTranslatedNotification } = await import('@/lib/notificationTranslation');
        const translated = await getTranslatedNotification(
          currentOrder.customerPhone,
          notificationType,
          { orderId: orderId.slice(0, 8) }
        );
        notificationMessage = translated || `Tu pedido #${orderId.slice(0, 8)} actualizado.`;
      }

      // Si el estado es delivered, actualizar sesión para modo RATING_ORDER
      if (newStatus === 'delivered') {
        await supabase
          .from('user_sessions')
          .upsert({
            phone: currentOrder.customerPhone,
            previous_state: 'RATING_ORDER',
            last_bot_message: JSON.stringify({
              selected_vendor_id: currentOrder.vendorId,
              pending_order_id: orderId
            }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'phone' });
      }

      await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          orderId,
          phoneNumber: currentOrder.customerPhone,
          message: notificationMessage
        }
      });

      toast({
        title: 'Estado actualizado',
        description: `El pedido ha sido marcado como ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      // Refrescar desde la base de datos para obtener el estado correcto
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:vendors(*)
        `)
        .eq('id', orderId)
        .single();

      if (data) {
        setOrders(prev => prev.map(order =>
          order.id === orderId
            ? {
              ...order,
              status: data.status as OrderStatus,
              updatedAt: new Date(data.updated_at)
            }
            : order
        ));
      }

      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del pedido',
        variant: 'destructive'
      });
    }
  };

  return {
    orders,
    loading,
    updateOrderStatus
  };
}