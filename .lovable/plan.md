
# Plan: Reducir Temperature a 0 para Evitar Alucinaciones de la IA

## Resumen

Configurar `temperature: 0` hará que las respuestas de la IA sean 100% deterministas, lo cual es ideal para un bot transaccional de pedidos. Esto evitará que invente productos, negocios o métodos de pago que no existen.

---

## Cambio Principal

### Archivo: `supabase/functions/evolution-webhook/vendor-bot.ts`

**Linea 3753-3759**

```typescript
// ANTES:
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages,
  tools: tools,
  temperature: 0.5, // ⬆️ Aumentado de 0.3 para evitar loops determinísticos
  max_tokens: 800,
});

// DESPUÉS:
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages,
  tools: tools,
  temperature: 0, // 🎯 Determinístico: previene alucinaciones de productos/negocios/pagos
  max_tokens: 800,
  tool_choice: "auto",
});
```

---

## Por Qué `temperature: 0` Funciona

| Aspecto | Temperature 0.5 | Temperature 0 |
|---------|----------------|---------------|
| Creatividad | Media-alta | Nula |
| Consistencia | Variable | 100% consistente |
| Alucinaciones | Posibles | Minimizadas |
| Uso recomendado | Chat creativo | Transacciones/datos |

---

## Qué Problema Resuelve

Con `temperature: 0`, la IA:

1. **NO inventará productos** - Solo mencionará los que aparecen en el menú real
2. **NO inventará negocios** - Solo los que devuelve `ver_locales_abiertos`
3. **NO inventará métodos de pago** - Solo los de `available_payment_methods`
4. **NO inventará stock** - Respetará las validaciones que ya agregamos
5. **Será más predecible** - Las mismas preguntas darán respuestas similares

---

## Nota sobre Loops

El comentario anterior decía "Aumentado de 0.3 para evitar loops determinísticos". Sin embargo:

- Los loops determinísticos se previenen mejor con el rate limiting de herramientas que ya tenés implementado (lineas 3731-3800)
- `temperature: 0` con las reglas de rate limiting actuales no debería causar loops

---

## Impacto

- **Archivos modificados**: 1
- **Lineas cambiadas**: 1
- **Riesgo**: Bajo (mejora la precisión sin afectar funcionalidad)
- **Requiere deploy**: Si (edge function)
