import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Search, RefreshCw, MessageSquare, Bot, Copy, ClipboardCheck, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface BotInteraction {
  id: string;
  phone: string;
  message_preview: string | null;
  intent_detected: string | null;
  confidence: number | null;
  action_taken: string | null;
  response_preview: string | null;
  state_before: string | null;
  state_after: string | null;
  error: string | null;
  created_at: string;
}

export default function BotInteractionReview() {
  const [interactions, setInteractions] = useState<BotInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "errors" | "low_confidence" | "fallback">("errors");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInteractions();
  }, [filter]);

  const fetchInteractions = async () => {
    setLoading(true);
    let query = supabase
      .from("bot_interaction_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "errors") {
      query = query.or("error.neq.null,response_preview.ilike.%no entendí%,response_preview.ilike.%Perdón%,action_taken.eq.unknown");
    } else if (filter === "low_confidence") {
      query = query.lt("confidence", 0.5);
    } else if (filter === "fallback") {
      query = query.or("response_preview.ilike.%no entendí%,response_preview.ilike.%Perdón%,action_taken.eq.unknown");
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching interactions:", error);
    } else {
      setInteractions(data || []);
    }
    setLoading(false);
  };

  const visibleInteractions = interactions.filter(i => !dismissed.has(i.id));

  const filteredInteractions = visibleInteractions.filter((i) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.message_preview?.toLowerCase().includes(q) ||
      i.response_preview?.toLowerCase().includes(q) ||
      i.intent_detected?.toLowerCase().includes(q) ||
      i.phone?.includes(q)
    );
  });

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return <Badge variant="outline">N/A</Badge>;
    if (confidence >= 0.8) return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">{(confidence * 100).toFixed(0)}%</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200">{(confidence * 100).toFixed(0)}%</Badge>;
    return <Badge variant="destructive">{(confidence * 100).toFixed(0)}%</Badge>;
  };

  const isErrorInteraction = (i: BotInteraction) => {
    return (
      i.error ||
      i.action_taken === "unknown" ||
      i.response_preview?.includes("no entendí") ||
      i.response_preview?.includes("Perdón") ||
      (i.confidence !== null && i.confidence < 0.3)
    );
  };

  const errorCount = visibleInteractions.filter(isErrorInteraction).length;

  const stats = {
    total: visibleInteractions.length,
    errors: errorCount,
    avgConfidence: visibleInteractions.length > 0
      ? (visibleInteractions.reduce((sum, i) => sum + (i.confidence || 0), 0) / visibleInteractions.length * 100).toFixed(0)
      : 0,
  };

  const copyErrorsForLovable = () => {
    const errors = filteredInteractions.filter(isErrorInteraction);
    if (errors.length === 0) {
      toast({ title: "Sin errores para copiar" });
      return;
    }

    const text = errors.map(i => {
      const date = format(new Date(i.created_at), "dd/MM HH:mm", { locale: es });
      return [
        `### ${date} | Intención: ${i.intent_detected || "N/A"} | Confianza: ${i.confidence ? (i.confidence * 100).toFixed(0) + "%" : "N/A"}`,
        `  👤 Usuario: "${i.message_preview || "(vacío)"}"`,
        `  🤖 Bot: "${i.response_preview || "(sin respuesta)"}"`,
        `  Estado: ${i.state_before} → ${i.state_after}`,
        i.error ? `  ❌ Error: ${i.error}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n---\n\n");

    const header = `Tengo ${errors.length} interacciones con errores en el bot. Necesito que analices las respuestas y me ayudes a corregir los flujos:\n\n`;
    navigator.clipboard.writeText(header + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: `${errors.length} errores copiados al portapapeles` });
  };

  const dismissInteraction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(prev => new Set(prev).add(id));
    toast({ title: "Interacción desestimada" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Revisión de Interacciones del Bot
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Revisá las interacciones problemáticas para mejorar el bot
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={copyErrorsForLovable}
            variant="outline"
            size="sm"
            disabled={filteredInteractions.filter(isErrorInteraction).length === 0}
          >
            {copied ? <ClipboardCheck className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copiado" : "Copiar para Lovable"}
          </Button>
          <Button onClick={fetchInteractions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Interacciones totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.errors}</div>
            <p className="text-sm text-muted-foreground">Con problemas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
            <p className="text-sm text-muted-foreground">Confianza promedio</p>
          </CardContent>
        </Card>
      </div>

      {dismissed.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <EyeOff className="h-4 w-4" />
          {dismissed.size} desestimada{dismissed.size > 1 ? "s" : ""}
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setDismissed(new Set())}>
            Restaurar todas
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por mensaje, intención, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="errors">Con errores</SelectItem>
            <SelectItem value="low_confidence">Baja confianza (&lt;50%)</SelectItem>
            <SelectItem value="fallback">Fallbacks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : filteredInteractions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">Sin interacciones problemáticas</p>
              <p className="text-sm mt-1">¡El bot está funcionando bien!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Fecha</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead className="w-[130px]">Intención</TableHead>
                    <TableHead className="w-[80px]">Confianza</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInteractions.map((interaction) => (
                    <>
                      <TableRow
                        key={interaction.id}
                        className={`cursor-pointer hover:bg-muted/50 ${isErrorInteraction(interaction) ? "bg-destructive/5" : ""}`}
                        onClick={() => setExpandedId(expandedId === interaction.id ? null : interaction.id)}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(interaction.created_at), "dd/MM HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {isErrorInteraction(interaction) && (
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            )}
                            <span className="text-sm line-clamp-1">{interaction.message_preview || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {interaction.intent_detected || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(interaction.confidence)}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {interaction.state_before} → {interaction.state_after}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Desestimar"
                              onClick={(e) => dismissInteraction(interaction.id, e)}
                            >
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <MessageSquare className="h-4 w-4 text-muted-foreground mt-1.5" />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedId === interaction.id && (
                        <TableRow key={`${interaction.id}-detail`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="p-4 space-y-3">
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">📱 Teléfono:</span>
                                <span className="text-sm ml-2">***{interaction.phone.slice(-4)}</span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">💬 Mensaje del usuario:</span>
                                <p className="text-sm mt-1 bg-background p-2 rounded border">{interaction.message_preview}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">🤖 Respuesta del bot:</span>
                                <p className="text-sm mt-1 bg-background p-2 rounded border whitespace-pre-wrap">{interaction.response_preview}</p>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span><strong>Acción:</strong> {interaction.action_taken}</span>
                                <span><strong>Estado:</strong> {interaction.state_before} → {interaction.state_after}</span>
                                {interaction.error && (
                                  <span className="text-destructive"><strong>Error:</strong> {interaction.error}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}