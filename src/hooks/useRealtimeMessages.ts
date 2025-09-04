import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/order';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeMessages(orderId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let channel: any;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const formattedMessages: Message[] = data?.map((msg: any) => ({
          id: msg.id,
          orderId: msg.order_id,
          sender: msg.sender as 'customer' | 'vendor' | 'system',
          content: msg.content,
          timestamp: new Date(msg.created_at),
          isRead: msg.is_read
        })) || [];

        setMessages(formattedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    const setupRealtime = () => {
      channel = supabase
        .channel(`messages-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `order_id=eq.${orderId}`
          },
          (payload) => {
            console.log('New message received:', payload);
            
            const newMessage: Message = {
              id: payload.new.id,
              orderId: payload.new.order_id,
              sender: payload.new.sender as 'customer' | 'vendor' | 'system',
              content: payload.new.content,
              timestamp: new Date(payload.new.created_at),
              isRead: payload.new.is_read
            };

            setMessages(prev => [...prev, newMessage]);
            
            // Show notification if message is from customer
            if (newMessage.sender === 'customer') {
              toast({
                title: '💬 Nuevo mensaje',
                description: newMessage.content.substring(0, 50) + '...',
              });
            }
          }
        )
        .subscribe();
    };

    fetchMessages();
    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [orderId, toast]);

  const sendMessage = async (content: string, sender: 'customer' | 'vendor') => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          order_id: orderId,
          sender,
          content,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      // If vendor is sending, notify customer via WhatsApp
      if (sender === 'vendor') {
        const { data: orderData } = await supabase
          .from('orders')
          .select('customer_phone')
          .eq('id', orderId)
          .single();

        if (orderData) {
          await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              orderId,
              phoneNumber: orderData.customer_phone,
              message: `📩 Mensaje del vendedor: ${content}`
            }
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    messages,
    loading,
    sendMessage
  };
}