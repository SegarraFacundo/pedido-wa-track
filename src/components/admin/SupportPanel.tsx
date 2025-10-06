import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  AlertCircle,
  User
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Ticket {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export default function SupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('support-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets' },
        () => fetchTickets()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
        () => fetchTickets()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        (payload: any) => {
          if (selectedTicket && payload.new.ticket_id === selectedTicket.id) {
            fetchMessages(selectedTicket.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'support',
          sender_id: user?.id,
          message: newMessage.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar la lista de mensajes inmediatamente
      if (data) {
        setMessages(prev => [...prev, data]);
      }

      // Enviar notificación por WhatsApp al cliente
      try {
        const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: selectedTicket.customer_phone,
            message: `📩 Respuesta de soporte:\n\n${newMessage.trim()}\n\n---\nTicket: ${selectedTicket.subject}`
          }
        });

        if (whatsappError) {
          console.error('Error sending WhatsApp:', whatsappError);
        }
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError);
      }

      setNewMessage("");
      toast({
        title: "Mensaje enviado",
        description: "El cliente recibirá tu respuesta por WhatsApp",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null
        })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      setSelectedTicket({ ...selectedTicket, status });
      fetchTickets();

      toast({
        title: "Estado actualizado",
        description: `Ticket marcado como ${status}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { icon: any; className: string; label: string }> = {
      open: { icon: Clock, className: "bg-yellow-500", label: "Abierto" },
      in_progress: { icon: AlertCircle, className: "bg-blue-500", label: "En Progreso" },
      resolved: { icon: CheckCircle, className: "bg-green-500", label: "Resuelto" },
      closed: { icon: XCircle, className: "bg-gray-500", label: "Cerrado" },
    };

    const config = variants[status] || variants.open;
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const filterTickets = (status: string) => {
    return tickets.filter(t => status === 'all' || t.status === status);
  };

  if (loading) {
    return <div className="p-8">Cargando tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Panel de Soporte</h2>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tickets Abiertos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tickets.filter(t => t.status === 'open').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">En Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tickets.filter(t => t.status === 'in_progress').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resueltos Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tickets.filter(t => t.status === 'resolved' && 
                new Date(t.updated_at).toDateString() === new Date().toDateString()
              ).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="open">Abiertos</TabsTrigger>
                <TabsTrigger value="in_progress">En Curso</TabsTrigger>
                <TabsTrigger value="resolved">Resueltos</TabsTrigger>
              </TabsList>

              {['all', 'open', 'in_progress', 'resolved'].map(status => (
                <TabsContent key={status} value={status} className="space-y-2">
                  {filterTickets(status).map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTicket?.id === ticket.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">
                            {ticket.customer_name || ticket.customer_phone}
                          </span>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Chat del Ticket */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {selectedTicket ? selectedTicket.subject : 'Selecciona un ticket'}
              </CardTitle>
              {selectedTicket && (
                <div className="flex gap-2">
                  {selectedTicket.status !== 'in_progress' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateTicketStatus('in_progress')}
                    >
                      En Progreso
                    </Button>
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <Button 
                      size="sm"
                      onClick={() => updateTicketStatus('resolved')}
                    >
                      Resolver
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedTicket ? (
              <div className="space-y-4">
                {/* Mensajes */}
                <div className="h-96 overflow-y-auto space-y-3 p-4 border rounded-lg">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'support' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.sender_type === 'support'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(msg.created_at).toLocaleTimeString('es-AR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input de Respuesta */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Escribe tu respuesta..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="resize-none"
                    rows={3}
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un ticket para ver la conversación</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}