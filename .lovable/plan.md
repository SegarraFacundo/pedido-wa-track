

## Plan: Bot multi-language help menu + dynamic language switching

### Problem
1. **Help menu hardcoded in Spanish**: The `mostrar_menu_ayuda` tool case (line ~2429 in `vendor-bot.ts`) returns a detailed help menu always in Spanish. The interceptor at line ~3807 uses `i18n.ts` but with a simplified version (`help.body`).
2. **Language never updates**: `detectLanguage()` only runs once (`if (!context.language)`), so if a user starts in Spanish and then writes in English, the bot keeps responding in Spanish.

### Changes

**1. `supabase/functions/evolution-webhook/i18n.ts` — Add detailed help menu translations**

Replace the current `help.header` and `help.body` with a richer `help.full` key containing the detailed menu (BUSCAR Y PEDIR, MI CARRITO, MIS PEDIDOS, MIS DIRECCIONES, CALIFICAR, SOPORTE sections) translated into all 4 languages. Keep the same visual structure with emojis and bullet points.

**2. `supabase/functions/evolution-webhook/vendor-bot.ts` — Use i18n for tool + re-detect language**

- **Tool handler (`mostrar_menu_ayuda`)**: Replace the hardcoded Spanish string with `t('help.full', lang)` using the context language.
- **Interceptor (FASE 5)**: Update to use `t('help.full', lang)` instead of combining header+body.
- **Language re-detection (line ~3022)**: Change from `if (!context.language)` to always re-detect and update when the detected language differs from the stored one. This way if a user switches to English mid-conversation, the bot adapts.

**3. Pass `lang` to tool execution**

Ensure the `lang` variable is accessible inside `executeTool()` so `mostrar_menu_ayuda` can use it. Currently `executeTool` receives `context` which has `context.language`, so we can use `context.language || 'es'` directly.

### Summary of scope
- 2 files modified: `i18n.ts` (add translations), `vendor-bot.ts` (use translations + re-detect language)
- No database changes needed
- Will need redeployment of `evolution-webhook` edge function

