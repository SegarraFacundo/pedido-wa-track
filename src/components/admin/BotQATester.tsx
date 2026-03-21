import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Play, Trash2, Save, Loader2, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, Plus, Zap, Download, Copy, ClipboardCheck
} from "lucide-react";

interface QaTest {
  id?: string;
  name: string;
  category: string;
  steps: string[];
  source: string;
  created_at?: string;
}

interface StepResult {
  step: string;
  response: string;
  success: boolean;
}

interface QaResult {
  id: string;
  test_id: string;
  run_at: string;
  status: string;
  steps_results: StepResult[];
  notes: string | null;
  test_name?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  basic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  edge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ambiguous: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  typos: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  multi_intent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  state_jump: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  real_users: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

export default function BotQATester() {
  const [activeTab, setActiveTab] = useState("generate");
  const [savedTests, setSavedTests] = useState<QaTest[]>([]);
  const [generatedTests, setGeneratedTests] = useState<QaTest[]>([]);
  const [results, setResults] = useState<QaResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [generateCount, setGenerateCount] = useState("10");
  const { toast } = useToast();

  const fetchSavedTests = useCallback(async () => {
    const { data } = await supabase
      .from("bot_qa_tests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSavedTests(data as unknown as QaTest[]);
  }, []);

  const fetchResults = useCallback(async () => {
    const { data } = await supabase
      .from("bot_qa_results")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(50);
    if (data) {
      // Enrich with test names
      const enriched = (data as unknown as QaResult[]).map(r => {
        const test = savedTests.find(t => t.id === r.test_id);
        return { ...r, test_name: test?.name || "Test eliminado" };
      });
      setResults(enriched);
    }
  }, [savedTests]);

  useEffect(() => { fetchSavedTests(); }, [fetchSavedTests]);
  useEffect(() => { if (savedTests.length > 0) fetchResults(); }, [savedTests, fetchResults]);

  const generateTests = async (mode: "generate" | "evolve" = "generate") => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-qa-tests", {
        body: {
          count: parseInt(generateCount),
          mode,
          existing_tests: mode === "evolve" ? savedTests.map(t => ({ name: t.name, steps: t.steps })) : [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const tests = (data.tests || []).map((t: QaTest) => ({
        ...t,
        source: mode === "evolve" ? "ai_evolved" : "ai_generated",
      }));
      setGeneratedTests(tests);
      toast({ title: `${tests.length} tests generados`, description: mode === "evolve" ? "Tests evolucionados" : "Revisá y guardá los que quieras" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error generando tests";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveTest = async (test: QaTest) => {
    const { error } = await supabase.from("bot_qa_tests").insert([{
      name: test.name,
      category: test.category,
      steps: JSON.parse(JSON.stringify(test.steps)),
      source: test.source,
    }]);
    if (error) {
      toast({ title: "Error guardando", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Test guardado" });
      setGeneratedTests(prev => prev.filter(t => t.name !== test.name));
      fetchSavedTests();
    }
  };

  const saveAllTests = async () => {
    const inserts = generatedTests.map(t => ({
      name: t.name,
      category: t.category,
      steps: JSON.parse(JSON.stringify(t.steps)),
      source: t.source,
    }));
    const { error } = await supabase.from("bot_qa_tests").insert(inserts);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${inserts.length} tests guardados` });
      setGeneratedTests([]);
      fetchSavedTests();
    }
  };

  const deleteTest = async (id: string) => {
    await supabase.from("bot_qa_tests").delete().eq("id", id);
    fetchSavedTests();
  };

  const runTest = async (test: QaTest) => {
    if (!test.id) return;
    setIsRunning(true);
    setRunningTestId(test.id);
    const testPhone = `qa_test_${Date.now()}`;
    const stepsResults: StepResult[] = [];

    try {
      for (const step of test.steps) {
        // Send message to bot
        await supabase.functions.invoke("evolution-webhook", {
          body: {
            event: "messages.upsert",
            data: {
              key: { remoteJid: testPhone },
              message: { conversation: step },
            },
          },
        });

        // Wait for processing
        await new Promise(r => setTimeout(r, 2000));

        // Get bot response
        const { data: sessionData } = await supabase
          .from("user_sessions")
          .select("last_bot_message")
          .eq("phone", testPhone)
          .maybeSingle();

        let botResponse = "(sin respuesta)";
        if (sessionData?.last_bot_message) {
          try {
            const ctx = JSON.parse(sessionData.last_bot_message);
            if (ctx.conversation_history?.length > 0) {
              const last = [...ctx.conversation_history].reverse().find((m: { role: string }) => m.role === "assistant");
              if (last) botResponse = (last as { content: string }).content;
            }
          } catch {
            botResponse = sessionData.last_bot_message;
          }
        }

        stepsResults.push({
          step,
          response: botResponse,
          success: botResponse !== "(sin respuesta)" && !botResponse.includes("error"),
        });
      }

      const allPassed = stepsResults.every(s => s.success);
      await supabase.from("bot_qa_results").insert([{
        test_id: test.id!,
        status: allPassed ? "passed" : "failed",
        steps_results: JSON.parse(JSON.stringify(stepsResults)),
      }]);

      toast({
        title: allPassed ? "✅ Test pasó" : "⚠️ Test con problemas",
        description: test.name,
        variant: allPassed ? "default" : "destructive",
      });

      // Cleanup test session
      await supabase.from("user_sessions").delete().eq("phone", testPhone);
      await supabase.from("chat_sessions").delete().eq("phone", testPhone);

      fetchResults();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error ejecutando test";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsRunning(false);
      setRunningTestId(null);
    }
  };

  const runAllTests = async () => {
    const testsToRun = filteredTests.filter(t => t.id);
    for (const test of testsToRun) {
      await runTest(test);
    }
  };

  const importFromErrors = async () => {
    const { data } = await supabase
      .from("bot_interaction_logs")
      .select("*")
      .not("error", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      toast({ title: "Sin errores recientes", description: "No hay interacciones con errores para importar" });
      return;
    }

    // Group by phone to create test sequences
    const byPhone: Record<string, string[]> = {};
    for (const log of data) {
      const phone = log.phone;
      if (!byPhone[phone]) byPhone[phone] = [];
      if (log.message_preview) byPhone[phone].push(log.message_preview);
    }

    const newTests: QaTest[] = Object.entries(byPhone)
      .filter(([, steps]) => steps.length >= 2)
      .slice(0, 5)
      .map(([phone, steps], i) => ({
        name: `Error real #${i + 1} (${phone.slice(-4)})`,
        category: "real_users",
        steps: steps.slice(0, 8),
        source: "real_user",
      }));

    if (newTests.length === 0) {
      toast({ title: "Sin secuencias válidas", description: "Los errores no forman secuencias de conversación" });
      return;
    }

    setGeneratedTests(prev => [...prev, ...newTests]);
    setActiveTab("generate");
    toast({ title: `${newTests.length} tests importados de errores reales` });
  };

  const filteredTests = categoryFilter === "all"
    ? savedTests
    : savedTests.filter(t => t.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🧪 QA Bot</h2>
          <p className="text-muted-foreground">Generá, ejecutá y revisá tests automatizados del bot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importFromErrors}>
            <Download className="mr-2 h-4 w-4" />
            Importar errores reales
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">
            <Sparkles className="mr-2 h-4 w-4" />
            Generar
          </TabsTrigger>
          <TabsTrigger value="tests">
            <Play className="mr-2 h-4 w-4" />
            Tests ({savedTests.length})
          </TabsTrigger>
          <TabsTrigger value="results">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Resultados ({results.length})
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generar Tests con IA</CardTitle>
              <CardDescription>La IA genera casos de prueba realistas para estresar el bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center flex-wrap">
                <Select value={generateCount} onValueChange={setGenerateCount}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => generateTests("generate")} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generar Tests
                </Button>
                <Button variant="outline" onClick={() => generateTests("evolve")} disabled={isGenerating || savedTests.length === 0}>
                  <Zap className="mr-2 h-4 w-4" />
                  Evolucionar
                </Button>
              </div>

              {generatedTests.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">{generatedTests.length} tests generados - revisá y guardá</p>
                    <Button size="sm" onClick={saveAllTests}>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar todos
                    </Button>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {generatedTests.map((test, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{test.name}</span>
                                <Badge variant="outline" className={CATEGORY_COLORS[test.category] || ""}>{test.category}</Badge>
                              </div>
                              <div className="space-y-0.5">
                                {test.steps.map((step, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    {i + 1}. "{step}"
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveTest(test)}>
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setGeneratedTests(prev => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="flex gap-2 items-center justify-between flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="edge">Edge</SelectItem>
                <SelectItem value="ambiguous">Ambiguous</SelectItem>
                <SelectItem value="typos">Typos</SelectItem>
                <SelectItem value="multi_intent">Multi-intent</SelectItem>
                <SelectItem value="state_jump">State jump</SelectItem>
                <SelectItem value="real_users">Real users</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runAllTests} disabled={isRunning || filteredTests.length === 0}>
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Ejecutar todos ({filteredTests.length})
            </Button>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredTests.map((test) => (
                <Card key={test.id} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{test.name}</span>
                        <Badge variant="outline" className={CATEGORY_COLORS[test.category] || ""}>{test.category}</Badge>
                        <Badge variant="secondary" className="text-xs">{test.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {test.steps.length} pasos: {test.steps.slice(0, 3).map(s => `"${s}"`).join(" → ")}{test.steps.length > 3 ? " ..." : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={isRunning}
                        onClick={() => runTest(test)}
                      >
                        {runningTestId === test.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTest(test.id!)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredTests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay tests guardados. Generá algunos en la pestaña "Generar".</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {results.map((result) => (
                <Card key={result.id} className="p-3">
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                  >
                    <div className="flex items-center gap-2">
                      {result.status === "passed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : result.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium text-sm">{result.test_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(result.run_at).toLocaleString("es-AR")}
                      </span>
                    </div>
                    {expandedResult === result.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>

                  {expandedResult === result.id && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {(result.steps_results || []).map((sr, i) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="flex items-start gap-1">
                            {sr.success ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium">👤 "{sr.step}"</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">🤖 {sr.response}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
              {results.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay resultados aún. Ejecutá algunos tests.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
