import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'support';
  message: string;
  created_at: string;
}

export function VendorSupportTickets({ vendorId }: { vendorId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
    setupRealtimeSubscription();
  }, [vendorId]);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const setupRealtimeSubscription = () => {
    const ticketsChannel = supabase
      .channel('vendor-tickets-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets'
      }, () => {
        fetchTickets();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: selectedTicket ? `ticket_id=eq.${selectedTicket.id}` : undefined
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  };

  const fetchTickets = async () => {
    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('phone')
        .eq('id', vendorId)
        .single();

      if (!vendor) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_phone', vendor.phone)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('phone, name')
        .eq('id', vendorId)
        .single();

      if (!vendor) throw new Error('Vendor not found');

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_phone: vendor.phone,
          customer_name: vendor.name,
          subject,
          priority,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      // Add initial message
      await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'customer',
          message: description
        });

      toast({
        title: 'Ticket creado',
        description: 'El equipo de soporte te contactará pronto'
      });

      setIsDialogOpen(false);
      setSubject('');
      setDescription('');
      setPriority('normal');
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el ticket',
        variant: 'destructive'
      });
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
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'customer',
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      toast({
        title: 'Mensaje enviado',
        description: 'Tu mensaje ha sido enviado al equipo de soporte'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const statusLabels: Record<string, string> = {
    open: 'Abierto',
    in_progress: 'En progreso',
    resolved: 'Resuelto',
    closed: 'Cerrado'
  };

  const priorityLabels: Record<string, string> = {
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente'
  };

  if (loading) {
    return <div>Cargando tickets...</div>;
  }

  // Vista de detalle del ticket
  if (selectedTicket) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
            <p className="text-sm text-muted-foreground">
              ID: #{selectedTicket.id.substring(0, 8)} • {statusLabels[selectedTicket.status]} • {priorityLabels[selectedTicket.priority]}
            </p>
          </div>
        </div>

        <Card className="flex flex-col h-[600px]">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.sender_type === 'customer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                size="icon"
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Vista de lista de tickets
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tickets de Soporte</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Ticket de Soporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Asunto</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Describe brevemente el problema"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el problema en detalle"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTicket} className="flex-1">
                  Crear Ticket
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No tienes tickets de soporte</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="p-4 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setSelectedTicket(ticket)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{ticket.subject}</h3>
                  <p className="text-sm text-muted-foreground">
                    ID: #{ticket.id.substring(0, 8)}
                  </p>
                  <p className="text-sm mt-2">
                    Estado: <span className="font-medium">{statusLabels[ticket.status]}</span>
                  </p>
                  <p className="text-sm">
                    Prioridad: <span className="font-medium">{priorityLabels[ticket.priority]}</span>
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {new Date(ticket.created_at).toLocaleDateString('es-AR')}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
