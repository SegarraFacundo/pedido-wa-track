import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

export function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const { continueAsGuest } = useCustomerAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (subject.trim().length < 3) return toast({ title: "Escribí un asunto", variant: "destructive" });
    if (message.trim().length < 5) return toast({ title: "Describí tu consulta", variant: "destructive" });
    if (phone.replace(/\D/g, "").length < 6) return toast({ title: "Ingresá un teléfono de contacto", variant: "destructive" });

    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) await continueAsGuest();

      const { data, error } = await supabase.functions.invoke("contactar-soporte", {
        body: { subject: subject.trim(), message: message.trim(), customer_phone: phone.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "No se pudo enviar", description: data.error, variant: "destructive" });
        return;
      }
      setDone(true);
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const reset = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setTimeout(() => {
        setDone(false);
        setSubject("");
        setMessage("");
        setPhone("");
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ayuda y soporte</DialogTitle>
          <DialogDescription>
            {done ? "Recibimos tu consulta." : "Contanos qué necesitás y te contactamos."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            ¡Gracias! Tu consulta quedó registrada y el equipo de soporte te va a contactar.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="s-subject">Asunto</Label>
              <Input id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Problema con un pedido" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-msg">Consulta</Label>
              <Textarea id="s-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Contanos el detalle…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-phone">Teléfono de contacto</Label>
              <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3464 55-5555" />
            </div>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => reset(false)}>Cerrar</Button>
          ) : (
            <Button onClick={submit} disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar consulta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
