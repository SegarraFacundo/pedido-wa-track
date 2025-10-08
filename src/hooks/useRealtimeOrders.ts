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
                  customerNameMasked: data.customer_name?.substring(0, 3) + '***',
                  customerPhoneMasked: '****' + data.customer_phone?.slice(-4),
                  addressSimplified: data.address?.split(',')[0]
                };

                setOrders(prev => [newOrder, ...prev]);
                
                toast({
                  title: '🆕 Nuevo pedido',
                  description: `Pedido #${newOrder.id.slice(0, 8)} recibido`,
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => prev.map(order => 
                order.id === payload.new.id
                  ? {
                      ...order,
                      status: payload.new.status as OrderStatus,
                      updatedAt: new Date(payload.new.updated_at),
                      deliveryPersonName: payload.new.delivery_person_name,
                      deliveryPersonPhone: payload.new.delivery_person_phone,
                      notes: payload.new.notes
                    }
                  : order
              ));

              toast({
                title: '✅ Pedido actualizado',
                description: `Estado cambiado a ${payload.new.status}`,
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
      
      // Si el estado es delivered, activar calificación
      if (newStatus === 'delivered') {
        notificationMessage += `\n\n⭐ *¿Cómo fue tu experiencia?*\n\nCalifica del 1 al 5:\n1️⃣ Muy malo\n2️⃣ Malo\n3️⃣ Regular\n4️⃣ Bueno\n5️⃣ Excelente\n\nEscribe solo el número (o "omitir" para saltar)`;
        
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
      }

      // Formatear el número de teléfono correctamente para WhatsApp
      let formattedPhone = currentOrder.customerPhone;
      if (formattedPhone.startsWith('549') && formattedPhone.length === 13) {
        // Agregar el 9 después del 549: 5493412699024 -> 54993412699024
        formattedPhone = '549' + '9' + formattedPhone.substring(3);
      }

      await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          orderId,
          phoneNumber: formattedPhone,
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