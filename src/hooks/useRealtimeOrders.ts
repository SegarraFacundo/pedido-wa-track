import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus } from '@/types/order';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeOrders(vendorId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

        const formattedOrders: Order[] = data?.map((order: any) => ({
          id: order.id,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          vendorId: order.vendor_id,
          vendorName: order.vendor?.name || '',
          items: (order.items || []).map((item: any) => ({
            id: item.product_id || item.id,
            name: item.product_name || item.name,
            quantity: item.quantity,
            price: Number(item.price),
            notes: item.notes
          })),
          total: Number(order.total),
          status: order.status as OrderStatus,
          address: order.address,
          coordinates: order.coordinates,
          estimatedDelivery: order.estimated_delivery ? new Date(order.estimated_delivery) : undefined,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          notes: order.notes,
          deliveryPersonName: order.delivery_person_name,
          deliveryPersonPhone: order.delivery_person_phone,
          payment_receipt_url: order.payment_receipt_url,
          address_is_manual: order.address_is_manual || false,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          paid_at: order.paid_at ? new Date(order.paid_at) : undefined,
          // Masked fields for vendor view
          customerNameMasked: order.customer_name?.substring(0, 3) + '***',
          customerPhoneMasked: '****' + order.customer_phone?.slice(-4),
          addressSimplified: order.address?.split(',')[0]
        })) || [];

        setOrders(formattedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast({
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
        .channel('orders-channel')
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
              // Fetch the complete order with vendor info
              const { data } = await supabase
                .from('orders')
                .select(`
                  *,
                  vendor:vendors(*)
                `)
                .eq('id', payload.new.id)
                .single();

              if (data) {
                const items = Array.isArray(data.items) ? data.items : [];
                const newOrder: Order = {
                  id: data.id,
                  customerName: data.customer_name,
                  customerPhone: data.customer_phone,
                  vendorId: data.vendor_id,
                  vendorName: data.vendor?.name || '',
                  items: items.map((item: any) => ({
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
                  customerNameMasked: data.customer_name?.substring(0, 3) + '***',
                  customerPhoneMasked: '****' + data.customer_phone?.slice(-4),
                  addressSimplified: data.address?.split(',')[0]
                };

                setOrders(prev => [newOrder, ...prev]);
                
                // Insertar notificación en la tabla de historial
                // Esto disparará el realtime para el NotificationCenter
                await supabase.from('vendor_notification_history').insert({
                  vendor_id: newOrder.vendorId,
                  type: 'new_order',
                  title: 'Nuevo Pedido',
                  message: `Pedido #${newOrder.id.slice(0, 8)} - $${newOrder.total.toLocaleString()}`,
                  data: { order_id: newOrder.id, total: newOrder.total }
                });

                toast({
                  title: '🆕 NUEVO PEDIDO INGRESADO',
                  description: `Pedido #${newOrder.id.slice(0, 8)} - $${newOrder.total.toFixed(2)}`,
                  duration: 10000,
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              const oldOrder = orders.find(o => o.id === payload.new.id);
              const newStatus = payload.new.status as OrderStatus;
              
              setOrders(prev => prev.map(order => 
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
              ));

              // Crear notificaciones según el tipo de cambio
              if (oldOrder && oldOrder.status !== newStatus) {
                let notificationType: 'order_cancelled' | 'order_updated' | 'payment_received' = 'order_updated';
                let title = 'Pedido Actualizado';
                let message = `Estado cambiado a ${newStatus}`;

                if (newStatus === 'cancelled') {
                  notificationType = 'order_cancelled';
                  title = 'Pedido Cancelado';
                  message = `El pedido #${payload.new.id.slice(0, 8)} fue cancelado`;
                }

                await supabase.from('vendor_notification_history').insert({
                  vendor_id: payload.new.vendor_id,
                  type: notificationType,
                  title,
                  message,
                  data: { order_id: payload.new.id, status: newStatus }
                });
              }

              // Notificación de pago recibido
              if (oldOrder && oldOrder.payment_status !== 'paid' && payload.new.payment_status === 'paid') {
                await supabase.from('vendor_notification_history').insert({
                  vendor_id: payload.new.vendor_id,
                  type: 'payment_received',
                  title: 'Pago Recibido',
                  message: `Se recibió el pago del pedido #${payload.new.id.slice(0, 8)}`,
                  data: { order_id: payload.new.id }
                });
              }

              toast({
                title: '✅ Pedido actualizado',
                description: `Estado cambiado a ${newStatus}`,
              });
            } else if (payload.eventType === 'DELETE') {
              setOrders(prev => prev.filter(order => order.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    };

    fetchOrders();
    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [vendorId, toast]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      // Primero verificar el estado actual
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        throw new Error('Pedido no encontrado');
      }

      // Evitar actualizar al mismo estado
      if (currentOrder.status === newStatus) {
        console.log(`Pedido ya está en estado ${newStatus}, ignorando actualización`);
        return;
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

      const statusDescriptions = {
        confirmed: 'El vendedor está preparando tu pedido.',
        preparing: 'Tu pedido está siendo preparado.',
        ready: 'Tu pedido está listo para entrega.',
        delivering: 'Tu pedido está en camino.',
        delivered: '¡Gracias por tu compra!',
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