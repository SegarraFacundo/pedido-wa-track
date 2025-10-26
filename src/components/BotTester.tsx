import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Store, ShoppingCart, MapPin, CreditCard, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface OrderState {
  selected_vendor_id?: string;
  selected_vendor_name?: string;
  cart: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  delivery_address?: string;
  payment_method?: string;
}

export function BotTester() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [orderState, setOrderState] = useState<OrderState>({ cart: [] });
  const [testPhone] = useState(`test_${Date.now()}`);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: newMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      // Call the bot through the evolution webhook
      const { data, error } = await supabase.functions.invoke('evolution-webhook', {
        body: {
          data: {
            key: {
              remoteJid: testPhone
            },
            message: {
              conversation: newMessage
            }
          }
        }
      });

      if (error) throw error;

      // Get updated context
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('last_bot_message')
        .eq('phone', testPhone)
        .maybeSingle();

      if (sessionData?.last_bot_message) {
        try {
          const context = JSON.parse(sessionData.last_bot_message);
          setOrderState({
            selected_vendor_id: context.selected_vendor_id,
            selected_vendor_name: context.selected_vendor_name,
            cart: context.cart || [],
            delivery_address: context.delivery_address,
            payment_method: context.payment_method
          });

          // Get last assistant message from conversation history
          if (context.conversation_history && context.conversation_history.length > 0) {
            const lastAssistant = [...context.conversation_history]
              .reverse()
              .find((msg: any) => msg.role === "assistant");
            
            if (lastAssistant) {
              const assistantMessage: Message = {
                role: "assistant",
                content: lastAssistant.content,
                timestamp: new Date()
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
          }
        } catch (e) {
          console.error('Error parsing context:', e);
        }
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Error al enviar mensaje",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearSession = async () => {
    try {
      await supabase
        .from('user_sessions')
        .delete()
        .eq('phone', testPhone);
      
      setMessages([]);
      setOrderState({ cart: [] });
      
      toast({
        title: "Sesión limpiada",
        description: "Puedes empezar una nueva conversación"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const isOrderComplete = !!(
    orderState.selected_vendor_id &&
    orderState.cart.length > 0 &&
    orderState.delivery_address &&
    orderState.payment_method
  );

  const cartTotal = orderState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chat Interface */}
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="bg-gradient-primary text-white rounded-t-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Chat con el Bot
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearSession}
              className="text-white hover:bg-white/20"
            >
              Limpiar
            </Button>
          </div>
          <p className="text-sm opacity-90">Prueba el bot conversacional</p>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Envía un mensaje para comenzar</p>
                  <p className="text-sm mt-2">Ej: "Quiero una pizza"</p>
                </div>
              )}
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted rounded-bl-none"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === "assistant" && <Bot className="h-4 w-4 mt-1" />}
                      {message.role === "user" && <User className="h-4 w-4 mt-1" />}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {message.timestamp.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2 rounded-bl-none">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4 flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isLoading}
                className="bg-gradient-primary hover:opacity-90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order State Visualization */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Estado del Pedido
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            {isOrderComplete ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completo
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Incompleto
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-4">
          {/* Vendor */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Store className={`h-4 w-4 ${orderState.selected_vendor_id ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="font-medium text-sm">Negocio</span>
            </div>
            {orderState.selected_vendor_name ? (
              <div className="ml-6">
                <p className="text-sm font-medium">{orderState.selected_vendor_name}</p>
                <p className="text-xs text-muted-foreground">ID: {orderState.selected_vendor_id?.substring(0, 8)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground ml-6">No seleccionado</p>
            )}
          </div>

          {/* Cart */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className={`h-4 w-4 ${orderState.cart.length > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="font-medium text-sm">Carrito ({orderState.cart.length})</span>
            </div>
            {orderState.cart.length > 0 ? (
              <div className="ml-6 space-y-2">
                {orderState.cart.map((item, i) => (
                  <div key={i} className="text-sm border-l-2 border-primary/30 pl-2">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity}x ${item.price} = ${item.price * item.quantity}
                    </p>
                  </div>
                ))}
                <div className="pt-2 border-t mt-2">
                  <p className="font-bold text-sm">Total: ${cartTotal}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground ml-6">Vacío</p>
            )}
          </div>

          {/* Address */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className={`h-4 w-4 ${orderState.delivery_address ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="font-medium text-sm">Dirección de Entrega</span>
            </div>
            {orderState.delivery_address ? (
              <p className="text-sm ml-6">{orderState.delivery_address}</p>
            ) : (
              <p className="text-sm text-muted-foreground ml-6">No especificada</p>
            )}
          </div>

          {/* Payment Method */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className={`h-4 w-4 ${orderState.payment_method ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="font-medium text-sm">Método de Pago</span>
            </div>
            {orderState.payment_method ? (
              <p className="text-sm ml-6 capitalize">{orderState.payment_method}</p>
            ) : (
              <p className="text-sm text-muted-foreground ml-6">No especificado</p>
            )}
          </div>

          {/* Order Ready Status */}
          {isOrderComplete && (
            <div className="border-2 border-green-500 rounded-lg p-3 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-bold">¡Pedido listo para crear!</span>
              </div>
              <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                Todos los datos necesarios están completos
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
