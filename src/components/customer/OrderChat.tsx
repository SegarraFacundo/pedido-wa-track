import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  sender_type: string;
  message: string;
  created_at: string | null;
}

export function OrderChat({ orderId, vendorId }: { orderId: string; vendorId: string }) {
  const { toast } = useToast();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = async (id: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender_type, message, created_at")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) ?? []);
  };

  // Buscar hilo existente de este negocio (RLS lo limita al del usuario).
  useEffect(() => {
    (async () => {
      const { data: chat } = await supabase
        .from("vendor_chats")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (chat) {
        setChatId(chat.id);
        loadMessages(chat.id);
      }
    })();
  }, [vendorId]);

  // Realtime: mensajes nuevos (incluye las respuestas del vendedor).
  useEffect(() => {
    if (!chatId) return;
    const ch = supabase
      .channel(`order-chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        (payload) =>
          setMessages((prev) => (prev.some((m) => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg])),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-mensaje-vendedor", {
        body: { order_id: orderId, message: msg },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "No se pudo enviar", description: data.error, variant: "destructive" });
        return;
      }
      setText("");
      if (data?.chat_id) {
        setChatId(data.chat_id);
        await loadMessages(data.chat_id);
      }
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Mensajes del sistema/bot no se muestran al cliente.
  const visible = messages.filter((m) => m.sender_type !== "bot");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Chat con el negocio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length > 0 && (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {visible.map((m) => {
              const mine = m.sender_type === "customer";
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input
            placeholder="Escribí un mensaje…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
