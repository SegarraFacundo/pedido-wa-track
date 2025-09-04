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
          items: order.items || [],
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
                const newOrder: Order = {
                  id: data.id,
                  customerName: data.customer_name,
                  customerPhone: data.customer_phone,
                  vendorId: data.vendor_id,
                  vendorName: data.vendor?.name || '',
                  items: (data.items as any[]) || [],
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
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send WhatsApp notification to customer
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            orderId,
            phoneNumber: order.customerPhone,
            message: `Tu pedido #${orderId.slice(0, 8)} ha sido ${newStatus}. ${
              newStatus === 'confirmed' ? 'El vendedor está preparando tu pedido.' :
              newStatus === 'preparing' ? 'Tu pedido está siendo preparado.' :
              newStatus === 'ready' ? 'Tu pedido está listo para entrega.' :
              newStatus === 'delivering' ? 'Tu pedido está en camino.' :
              newStatus === 'delivered' ? '¡Tu pedido ha sido entregado! Gracias por tu compra.' :
              newStatus === 'cancelled' ? 'Tu pedido ha sido cancelado.' : ''
            }`
          }
        });
      }

      toast({
        title: 'Estado actualizado',
        description: `El pedido ha sido marcado como ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
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