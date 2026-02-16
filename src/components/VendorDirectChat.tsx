import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return 'Cliente';
  return `Cliente ***${phone.slice(-4)}`;
}

export function VendorDirectChat({ vendorId }: VendorDirectChatProps) {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState<string>('');
  const [vendorPhone, setVendorPhone] = useState<string>('');
  const [endChatDialogOpen, setEndChatDialogOpen] = useState(false);
  const [chatToEnd, setChatToEnd] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end', 
            inline: 'nearest' 
          });
        }
        // También intentar con el scrollArea directamente
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const setupRealtimeSubscription = useCallback(() => {
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
            description: `${maskPhone(newChat.customer_phone)} quiere hablar contigo`
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
            
            // Evitar duplicados verificando si el mensaje ya existe
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                return prev;
              }
              return [...prev, newMessage];
            });
            
            // Forzar scroll inmediatamente
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
              if (scrollAreaRef.current) {
                const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) {
                  scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
              }
            }, 100);
          }
          
          if (newMessage.sender_type === 'customer') {
            toast({
              title: '📩 Nuevo mensaje',
              description: newMessage.message.substring(0, 50) + (newMessage.message.length > 50 ? '...' : '')
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, selectedChat, toast]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const fetchVendorInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('name, phone, whatsapp_number')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      setVendorName(data?.name || 'el vendedor');
      // Usar whatsapp_number si existe, sino phone
      setVendorPhone(data?.whatsapp_number || data?.phone || '');
    } catch (error) {
      console.error('Error fetching vendor info:', error);
      setVendorName('el vendedor');
    }
  }, [vendorId]);

  const fetchActiveChats = useCallback(async () => {
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
  }, [vendorId, toast]);

  useEffect(() => {
    fetchVendorInfo();
    fetchActiveChats();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [fetchVendorInfo, fetchActiveChats, setupRealtimeSubscription]);

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
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    const lowerMessageText = messageText.toLowerCase();
    
    // Detectar comando "activar bot" o variaciones - sin necesidad de chat seleccionado
    if (lowerMessageText === 'activar bot' || lowerMessageText === 'bot activo' || lowerMessageText === 'reactivar bot') {
      if (activeChats.length === 0) {
        toast({
          title: 'ℹ️ No hay chats activos',
          description: 'No hay ningún chat directo activo en este momento',
        });
        setNewMessage('');
        return;
      }

      try {
        
        // Obtener todos los clientes afectados ANTES de cerrar los chats
        const customerPhones = activeChats.map(chat => chat.customer_phone);



        // Cerrar todos los chats activos de este vendedor
        const { error: updateError } = await supabase
          .from('vendor_chats')
          .update({
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq('vendor_id', vendorId)
          .eq('is_active', true);

        if (updateError) {
          console.error('❌ Error closing chats:', updateError);
          throw updateError;
        }


        // Desactivar modo chat para todos los clientes y notificar
        for (const phone of customerPhones) {
          
          const { error: sessionError } = await supabase
            .from('user_sessions')
            .update({ 
              in_vendor_chat: false, 
              assigned_vendor_phone: null,
              updated_at: new Date().toISOString()
            })
            .eq('phone', phone);

          if (sessionError) {
            console.error('❌ Error updating user_sessions:', sessionError);
          }

          // Notificar al cliente que el bot está activo
          
          const { error: notifyError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumber: phone,
              message: `✅ El bot está activo nuevamente.`
            }
          });

          if (notifyError) {
            console.error('❌ Error sending notification:', notifyError);
          }
        }

        // Limpiar estado local
        setActiveChats([]);
        setSelectedChat(null);
        setMessages([]);
        setNewMessage('');

        toast({
          title: '✅ Bot reactivado',
          description: `Bot activo nuevamente para ${customerPhones.length} cliente(s)`,
        });
        
      } catch (error) {
        console.error('❌ Error activating bot:', error);
        toast({
          title: 'Error',
          description: 'No se pudo reactivar el bot',
          variant: 'destructive'
        });
      }
      return;
    }

    // Mensaje normal - requiere chat seleccionado
    if (!selectedChat) {
      toast({
        title: 'Atención',
        description: 'Selecciona un chat o escribe "activar bot" para reactivar el bot',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data: insertedMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChat.id,
          sender_type: 'vendor',
          message: newMessage
        })
        .select()
        .single();

      if (error) throw error;

      // Agregar inmediatamente al estado local para feedback instantáneo
      if (insertedMessage) {
        const newMsg: ChatMessage = {
          ...insertedMessage,
          sender_type: insertedMessage.sender_type as 'customer' | 'vendor' | 'bot',
          created_at: new Date(insertedMessage.created_at)
        };
        setMessages(prev => [...prev, newMsg]);
      }

      // Desactivar bot automáticamente cuando el vendedor escribe cualquier mensaje
      await supabase
        .from('user_sessions')
        .upsert({
          phone: selectedChat.customer_phone,
          in_vendor_chat: true,
          assigned_vendor_phone: vendorPhone,
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' });

      // Enviar mensaje por WhatsApp al cliente con el nombre del negocio
      await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phoneNumber: selectedChat.customer_phone,
          message: `📩 Mensaje de *${vendorName}*:\n${newMessage}`,
          orderId: selectedChat.id
        }
      });

      setNewMessage('');
      
      // Scroll to bottom after sending
      scrollToBottom();
      
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

  const requestEndChat = (chatId: string) => {
    setChatToEnd(chatId);
    setEndChatDialogOpen(true);
  };

  const confirmEndChat = async () => {
    if (!chatToEnd) return;
    const chatId = chatToEnd;
    setEndChatDialogOpen(false);
    setChatToEnd(null);

    try {
      const chat = activeChats.find(c => c.id === chatId);
      
      const { error } = await supabase
        .from('vendor_chats')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;

      if (chat) {
        await supabase
          .from('user_sessions')
          .update({
            in_vendor_chat: false,
            assigned_vendor_phone: null,
            updated_at: new Date().toISOString()
          })
          .eq('phone', chat.customer_phone);

        // Notificar al cliente que el bot está activo nuevamente
        await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: chat.customer_phone,
            message: `✅ El bot está activo nuevamente. Puedes seguir haciendo consultas o pedidos.`
          }
        });
      }

      setActiveChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }

      toast({
        title: '✅ Chat finalizado',
        description: 'El bot se ha reactivado y el cliente fue notificado'
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
                      {maskPhone(chat.customer_phone)}
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
                    <p className="font-medium">{maskPhone(selectedChat.customer_phone)}</p>
                    <p className="text-xs text-muted-foreground">
                      Chat iniciado {format(selectedChat.started_at, 'HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => requestEndChat(selectedChat.id)}
                >
                  Finalizar Chat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px] p-4" ref={scrollAreaRef}>
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
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={selectedChat ? "Escribe un mensaje..." : 'Escribe "activar bot" para reactivar el bot'}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Escribe "activar bot" para cerrar todos los chats y reactivar el bot
                </p>
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

      <AlertDialog open={endChatDialogOpen} onOpenChange={setEndChatDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar este chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Al finalizar, el bot se reactivará automáticamente y el cliente será notificado para que pueda seguir interactuando con el bot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatToEnd(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEndChat}>Finalizar Chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}