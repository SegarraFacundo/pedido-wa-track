import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QA_SYSTEM_PROMPT = `Eres un generador de pruebas QA para un bot de pedidos de comida llamado "Lapacho Delivery".

Tu tarea es generar mensajes de usuario REALISTAS que puedan romper o desafiar el flujo del bot.

NO debes explicar nada. NO debes dar contexto. SOLO debes generar listas de mensajes que un usuario podría enviar.

TIPOS DE CASOS A GENERAR:
- Búsqueda ambigua: "quiero algo rico", "no se que comer"
- Cambio de decisión: "quiero pizza", "no mejor sushi"
- Acciones fuera de orden: "confirmar pedido" sin carrito
- Producto inexistente: "quiero hamburguesa de unicornio"
- Dirección adelantada: "mi direccion es san martin 123"
- Uso de números: "1", "2"
- Mensajes inválidos: "asdf", "..."
- Usuario adulto mayor: "hola hijo quiero comer algo"
- Multi intención: "quiero pizza y ver el carrito"
- Errores repetidos: "no entiendo", "no entiendo"
- Cancelación a mitad de flujo
- Cambio de negocio con carrito lleno
- Escritura con errores ortográficos

REGLAS:
- Cada test debe tener entre 3 y 8 mensajes
- Los mensajes deben ser realistas en español argentino
- Incluir errores humanos y ambigüedad
- NO repetir casos
- NO inventar respuestas del bot
- SOLO generar mensajes del usuario`;

const EVOLUTION_PROMPT = `Eres un analista QA de un bot de pedidos.

Tu tarea es mejorar y expandir casos de prueba existentes.

OBJETIVO:
- Encontrar casos que el bot NO está cubriendo
- Generar nuevas variantes más complejas
- Combinar errores (ej: ambigüedad + cambio de decisión)
- Simular usuarios reales argentinos

REGLAS:
- No repetir tests existentes
- Hacerlos más complejos progresivamente
- Simular usuarios reales`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { count = 10, category = "mixed", existing_tests = [], mode = "generate" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let userPrompt: string;
    let systemPrompt: string;

    if (mode === "evolve") {
      systemPrompt = EVOLUTION_PROMPT;
      userPrompt = `Tests existentes:\n${JSON.stringify(existing_tests, null, 2)}\n\nGenera ${count} tests NUEVOS más complejos que los anteriores. Combiná errores y situaciones difíciles.\n\nResponde SOLO con JSON válido:\n{"tests":[{"name":"...","category":"...","steps":["msg1","msg2",...]}]}`;
    } else {
      systemPrompt = QA_SYSTEM_PROMPT;
      const categoryHint = category !== "mixed" ? `\nFocalizate en tests de tipo: ${category}` : "";
      const existingHint = existing_tests.length > 0
        ? `\n\nNO repitas estos tests existentes:\n${existing_tests.map((t: { name: string }) => t.name).join(", ")}`
        : "";
      userPrompt = `Genera exactamente ${count} tests de QA.${categoryHint}${existingHint}\n\nCategorías válidas: basic, edge, ambiguous, typos, multi_intent, state_jump, real_users\n\nResponde SOLO con JSON válido:\n{"tests":[{"name":"...","category":"...","steps":["msg1","msg2",...]}]}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_qa_tests",
              description: "Return generated QA test cases",
              parameters: {
                type: "object",
                properties: {
                  tests: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string", enum: ["basic", "edge", "ambiguous", "typos", "multi_intent", "state_jump", "real_users"] },
                        steps: { type: "array", items: { type: "string" } }
                      },
                      required: ["name", "category", "steps"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["tests"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_qa_tests" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit alcanzado, intentá en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agregá fondos en Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("No structured output from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-qa-tests error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
