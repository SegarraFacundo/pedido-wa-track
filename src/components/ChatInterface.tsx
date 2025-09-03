import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message } from "@/types/order";
import { Send, Phone, MoreVertical, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  orderId: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onClose?: () => void;
  vendorName: string;
  customerName: string;
  isVendorView?: boolean;
}

export function ChatInterface({
  orderId,
  messages,
  onSendMessage,
  onClose,
  vendorName,
  customerName,
  isVendorView = false
}: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const chatPartnerName = isVendorView ? customerName : vendorName;
  const currentUserType = isVendorView ? 'vendor' : 'customer';
  
  return (
    <Card className="h-full flex flex-col max-h-[600px]">
      <CardHeader className="bg-gradient-primary text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarFallback className="bg-white text-primary font-semibold">
                {chatPartnerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{chatPartnerName}</CardTitle>
              <p className="text-sm opacity-90">Pedido #{orderId.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <Phone className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[400px] p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender === currentUserType;
              const isSystem = message.sender === 'system';
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isOwnMessage && "justify-end",
                    isSystem && "justify-center"
                  )}
                >
                  {isSystem ? (
                    <div className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
                      {message.content}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-muted rounded-bl-none"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={cn(
                        "text-xs mt-1",
                        isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {new Date(message.timestamp).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="bg-gradient-primary hover:opacity-90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}