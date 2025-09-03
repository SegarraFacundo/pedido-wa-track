import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Phone, MessageSquare, Bot, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function TwilioConfig() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isConfiguring, setIsConfiguring] = useState(false);
  const { toast } = useToast();

  const handleConfigureTwilio = async () => {
    setIsConfiguring(true);
    
    // This would typically save the configuration to your backend
    toast({
      title: "Configuración guardada",
      description: "Tu webhook de Twilio ha sido configurado correctamente.",
    });
    
    setIsConfiguring(false);
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Configuración de Twilio WhatsApp
        </CardTitle>
        <CardDescription>
          Conecta tu número de WhatsApp Business a través de Twilio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook">Webhook URL de tu Edge Function</Label>
          <Input
            id="webhook"
            placeholder="https://tu-proyecto.supabase.co/functions/v1/twilio-webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Copia esta URL en la configuración de tu número de WhatsApp en Twilio
          </p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agente de IA Activado
          </h4>
          <p className="text-sm text-muted-foreground">
            Tu bot procesará automáticamente los pedidos usando GPT-4 para:
          </p>
          <ul className="text-sm space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-primary" />
              Tomar pedidos automáticamente
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-primary" />
              Responder consultas de estado
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-primary" />
              Gestionar cancelaciones
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-primary" />
              Asignar vendedores automáticamente
            </li>
          </ul>
        </div>

        <Button 
          onClick={handleConfigureTwilio}
          className="w-full"
          disabled={!webhookUrl || isConfiguring}
        >
          {isConfiguring ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Configurando...
            </>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              Configurar Twilio
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Necesitarás configurar estas variables en Supabase:</p>
          <ul className="ml-4 space-y-1 font-mono">
            <li>• TWILIO_ACCOUNT_SID</li>
            <li>• TWILIO_AUTH_TOKEN</li>
            <li>• TWILIO_WHATSAPP_NUMBER</li>
            <li>• OPENAI_API_KEY</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}