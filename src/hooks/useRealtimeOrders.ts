import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus } from '@/types/order';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeOrders(vendorId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let channel: any;

    const formatOrder = (data: any): Order => ({
      id: data.id,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      vendorId: data.vendor_id,
      vendorName: data.vendor?.name || '',
      items: (Array.isArray(data.items) ? data.items : []).map((item: any) => ({
        id: item.product_id || item.id,
        name: item.product_name || item.name,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes
      })),
      total: Number(data.total),
      status: data.status as OrderStatus,
      address: data.address,
      coordinates: data.coordinates ? (data.coordinates as any) : undefined,
      estimatedDelivery: data.estimated_delivery ? new Date(data.estimated_delivery) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      notes: data.notes,
      deliveryPersonName: data.delivery_person_name,
      deliveryPersonPhone: data.delivery_person_phone,
      payment_receipt_url: data.payment_receipt_url,
      address_is_manual: data.address_is_manual || false,
      payment_status: data.payment_status,
      payment_method: data.payment_method as 'efectivo' | 'transferencia' | 'mercadopago' | undefined,
      paid_at: data.paid_at ? new Date(data.paid_at) : undefined,
      delivery_type: (data.delivery_type as 'delivery' | 'pickup') || 'delivery',
      customerNameMasked: data.customer_name?.substring(0, 3) + '***',
      customerPhoneMasked: '****' + data.customer_phone?.slice(-4),
      addressSimplified: data.address?.split(',')[0]
    });

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

              toastRef.current({
                title: '✅ Pedido actualizado',
                description: `Estado cambiado a ${newStatus}`,
              });
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

      // Send WhatsApp notification to customer
      const statusMessages = {
        confirmed: 'confirmado',
        preparing: 'está siendo preparado',
        ready: 'está listo',
        delivering: 'está en camino',
        delivered: 'ha sido entregado',
        cancelled: 'ha sido cancelado'
      };

      const isPickup = currentOrder.delivery_type === 'pickup';
      const statusDescriptions = {
        confirmed: 'El vendedor está preparando tu pedido.',
        preparing: 'Tu pedido está siendo preparado.',
        ready: isPickup 
          ? 'Tu pedido está listo para retirar en el local.' 
          : 'Tu pedido está listo para entrega.',
        delivering: 'Tu pedido está en camino.',
        delivered: isPickup
          ? '¡Gracias por retirarlo!'
          : '¡Gracias por tu compra!',
        cancelled: 'Si tienes alguna duda, contacta al vendedor.'
      };

      let notificationMessage = `Tu pedido #${orderId.slice(0, 8)} ${statusMessages[newStatus as keyof typeof statusMessages]}. ${statusDescriptions[newStatus as keyof typeof statusDescriptions]}`;
      
      // Si el estado es delivered, enviar mensaje con prompt de calificación
      if (newStatus === 'delivered') {
        // Actualizar sesión del usuario para que esté en modo RATING_ORDER
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
        
        // Enviar mensaje de entrega con prompt de calificación
        notificationMessage = `🎉 ¡Tu pedido #${orderId.slice(0, 8)} ha sido entregado! 

¡Esperamos que lo disfrutes! 🍽️

📝 *¿Querés calificar tu experiencia?*
Tu opinión nos ayuda a mejorar.

Podés calificar:
⏱️ Tiempo de entrega (1-5 estrellas)
👥 Atención del negocio (1-5 estrellas)
📦 Calidad del producto (1-5 estrellas)

Solo escribí "quiero calificar" o "calificar" cuando quieras hacerlo. Es opcional 😊`;
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