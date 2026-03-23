

# Plan: Rewrite System Prompt and Bot Behavior for Human-like UX

## Problem
The current bot has a rigid, menu-driven approach with overly technical prompts. The user wants a friendlier, simpler bot that adapts to the user instead of forcing the user to adapt to the bot.

## What Changes

### 1. Rewrite `simplified-prompt.ts` — New system prompt philosophy
The current prompt is terse and mechanical ("ESTADO: idle", "Sé ULTRA breve"). Replace with a warm, conversational tone that follows the user's guidelines:

- Replace "Sos un vendedor" → "Sos un asistente amable de Lapacho"
- Replace rigid rules like "máximo 4 líneas" → "Frases cortas, amable pero directo"
- Add explicit guidance for ambiguous inputs: guide with simple questions instead of "no entendí"
- Add guidance for gibberish/unclear messages: offer clear options instead of fallback
- Add "never blame the user" and "always offer a way out" rules
- Remove the mechanical state labels from the prompt (keep them internally)
- Make state instructions more conversational and less robotic

Key changes to `getStateInstructions`:
- **idle**: Instead of "Usá buscar_productos" → "Preguntale qué busca, sugerí categorías"
- **browsing**: Remove "NUNCA inventes resultados" (already a global rule) → "Ayudalo a elegir con preguntas simples"
- **shopping**: Remove menu-speak like "Enviá un número del menú" → "Guialo para elegir productos"
- **needs_address**: Instead of "Todo se trata como dirección" → "Pedile la dirección de forma amable"
- All states: Replace "🤔 Perdón, no entendí" with helpful contextual suggestions

### 2. Update `vendor-bot.ts` — Improve fallback responses and interceptors

**Fallback message improvements** (~6 locations):
- Replace all instances of `"🤔 Perdón, no entendí. ¿Podés repetir?"` with contextual, helpful messages
- In idle: "Te ayudo 🙂 ¿Qué te gustaría? Puedo mostrarte negocios o buscar algo"
- In browsing: "Decime el número o nombre del negocio que te interesa, o buscá otro producto"
- In shopping: Show available products as numbered list instead of generic error

**Interceptor improvements**:
- In the idle/browsing product interceptor (line ~4088): Don't call `buscar_productos` for gibberish or very short ambiguous messages. Instead, offer guidance
- Add a "confused user" interceptor: if user sends >2 unrecognized messages in a row, simplify options to 2-3 clear choices
- In shopping state: when user says something unrecognized, show cart status + "¿Querés agregar algo más o confirmar?"

**Remove rigid menu formatting**:
- The welcome/help menu (line ~3090 reset command, ~4147 help interceptor) currently shows numbered emoji lists. Simplify to conversational text
- Don't show "1️⃣ 🏪 Ver negocios abiertos" style — instead say "¿Qué querés hacer? Puedo mostrarte negocios, buscar un producto..."

### 3. Track "confusion count" in context
Add a `confusion_count` field to track consecutive unrecognized messages. After 2+ failures, auto-simplify to basic options. Reset on any successful action.

## Files to modify

| File | Changes |
|------|---------|
| `supabase/functions/evolution-webhook/simplified-prompt.ts` | Rewrite system prompt and state instructions for warm, human-like tone |
| `supabase/functions/evolution-webhook/vendor-bot.ts` | Update fallback messages, add confusion tracking, simplify menus |
| `supabase/functions/evolution-webhook/types.ts` | Add `confusion_count` to ConversationContext |

## What stays the same
- All tool definitions (tools-definitions.ts) — unchanged
- All tool execution logic (ejecutarHerramienta) — unchanged  
- State machine transitions — unchanged
- Interceptors for shopping/address/payment — logic unchanged, only messages improved
- TOOLS_BY_STATE restrictions — unchanged

