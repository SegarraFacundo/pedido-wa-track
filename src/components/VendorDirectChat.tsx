import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, User, Bot, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Chat {
  id: string;
  customer_phone: string;
  is_active: boolean;
  vendor_agent_name?: string;
  started_at: Date;
  ended_at?: Date;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_type: 'customer' | 'vendor' | 'bot';
  message: string;
  created_at: Date;
}

interface VendorDirectChatProps {
  vendorId: string;
}

export function VendorDirectChat({ vendorId }: VendorDirectChatProps) {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchVendorInfo();
    fetchActiveChats();
    setupRealtimeSubscription();
  }, [vendorId]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`vendor-chats-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vendor_chats',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          const newChat = {
            ...payload.new,
            started_at: new Date(payload.new.started_at),
            ended_at: payload.new.ended_at ? new Date(payload.new.ended_at) : undefined
          } as Chat;
          
          setActiveChats(prev => [newChat, ...prev]);
          
          toast({
            title: '💬 Nuevo chat',
            description: `Cliente ${newChat.customer_phone} quiere hablar contigo`
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = {
            ...payload.new,
            created_at: new Date(payload.new.created_at)
          } as ChatMessage;
          
          if (selectedChat && newMessage.chat_id === selectedChat.id) {
            setMessages(prev => [...prev, newMessage]);
          }
          
          if (newMessage.sender_type === 'customer') {
            toast({
              title: '📩 Nuevo mensaje',
              description: newMessage.message.substring(0, 50) + '...'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchVendorInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('name')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      setVendorName(data?.name || 'el vendedor');
    } catch (error) {
      console.error('Error fetching vendor info:', error);
      setVendorName('el vendedor');
    }
  };

  const fetchActiveChats = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_chats')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      setActiveChats(data?.map(chat => ({
        ...chat,
        started_at: new Date(chat.started_at),
        ended_at: chat.ended_at ? new Date(chat.ended_at) : undefined
      })) || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los chats',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data?.map(msg => ({
        ...msg,
        sender_type: msg.sender_type as 'customer' | 'vendor' | 'bot',
        created_at: new Date(msg.created_at)
      })) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!selectedChat || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChat.id,
          sender_type: 'vendor',
          message: newMessage
        });

      if (error) throw error;

      // Activar modo chat directo para pausar el bot
      await supabase
        .from('user_sessions')
        .upsert({
          phone: selectedChat.customer_phone,
          in_vendor_chat: true,
          assigned_vendor_phone: vendorId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' });

      // Normalizar el número de teléfono antes de enviar
      // La edge function send-whatsapp-notification se encargará del formateo final
      const phoneToSend = selectedChat.customer_phone;
      
      console.log('Sending message to customer:', phoneToSend);

      // Enviar mensaje por WhatsApp al cliente con el nombre del negocio
      await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phoneNumber: phoneToSend,
          message: `📩 Mensaje de *${vendorName}*:\n${newMessage}`,
          orderId: selectedChat.id // Para logging
        }
      });

      setNewMessage('');
      toast({
        title: '✅ Mensaje enviado',
        description: 'El cliente recibirá tu mensaje por WhatsApp'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    }
  };

  const endChat = async (chatId: string) => {
    if (!confirm('¿Estás seguro de finalizar este chat?')) return;

    try {
      // Obtener info del chat antes de cerrarlo
      const chatToEnd = activeChats.find(c => c.id === chatId);
      
      const { error } = await supabase
        .from('vendor_chats')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;

      // Desactivar modo chat directo para reactivar el bot
      if (chatToEnd) {
        await supabase
          .from('user_sessions')
          .update({
            in_vendor_chat: false,
            assigned_vendor_phone: null
          })
          .eq('phone', chatToEnd.customer_phone);
      }

      setActiveChats(prev => prev.filter(chat => chat.id !== chatId));
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }

      toast({
        title: '✅ Chat finalizado',
        description: 'El bot se ha reactivado para este cliente'
      });
    } catch (error) {
      console.error('Error ending chat:', error);
      toast({
        title: 'Error',
        description: 'No se pudo finalizar el chat',
        variant: 'destructive'
      });
    }
  };

  const getSenderIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <User className="h-4 w-4" />;
      case 'vendor':
        return <Users className="h-4 w-4" />;
      case 'bot':
        return <Bot className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Lista de chats activos */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chats Activos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {activeChats.map((chat) => (
              <div
                key={chat.id}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedChat?.id === chat.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedChat(chat)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {chat.customer_phone}
                    </span>
                  </div>
                  <Badge variant="default" className="text-xs">
                    Activo
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciado: {format(chat.started_at, 'HH:mm', { locale: es })}
                </p>
              </div>
            ))}

            {activeChats.length === 0 && (
              <div className="text-center py-12 px-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  No hay chats activos
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Los clientes pueden iniciar un chat enviando "hablar con vendedor" al bot
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de chat */}
      <Card className="md:col-span-2">
        {selectedChat ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{selectedChat.customer_phone}</p>
                    <p className="text-xs text-muted-foreground">
                      Chat iniciado {format(selectedChat.started_at, 'HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => endChat(selectedChat.id)}
                >
                  Finalizar Chat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px] p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === 'vendor'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.sender_type === 'vendor'
                            ? 'bg-primary text-primary-foreground'
                            : message.sender_type === 'bot'
                            ? 'bg-muted'
                            : 'bg-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getSenderIcon(message.sender_type)}
                          <span className="text-xs opacity-80">
                            {format(message.created_at, 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm">{message.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Selecciona un chat para comenzar
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}