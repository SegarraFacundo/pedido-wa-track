

# Plan: Mejorar el System Prompt del NLU

## Objetivo
Reemplazar el prompt actual de `buildNLUPrompt()` en `nlu.ts` con el prompt mejorado que el usuario proporcionó, adaptado a nuestros intent names y estructura (`params` en vez de `entities`).

## Cambio único: `nlu.ts` → `buildNLUPrompt()`

Reescribir la función para usar el nuevo prompt estricto con estas adaptaciones:

- **Nombre del bot**: "Lapacho Delivery" (como indica el prompt)
- **Campo `entities` → `params`**: Nuestro sistema usa `params`, no `entities`. El prompt se adapta para pedir `params`
- **Whitelist de intents**: Usar nuestra lista existente (24 intents) en vez de la del prompt (17 intents). Incluye los que no están en su lista: `empty_cart`, `select_delivery`, `give_address`, `select_payment`, `rate_order`, `rate_platform`, `view_offers`, `view_schedule`, `reset`, `change_language`
- **Reglas de confianza**: Adoptar tal cual (0.9/0.7/0.5/<0.3)
- **Reglas estrictas**: Adoptar todas (solo JSON, no markdown, no explicaciones, no inventar datos)
- **Casos especiales**: Adoptar + agregar los context hints por estado que ya tenemos (browsing→números=vendor, shopping→números=producto, needs_address→texto=dirección)
- **Ejemplos**: Adaptar a nuestro formato con `params` en vez de `entities`

### Lo que NO cambia
- La función `classifyIntent()` y toda la lógica de validación/parsing posterior se mantiene idéntica
- Los tipos `Intent`, `NLUResult` no cambian
- La constante `INTENT_LIST` no cambia

### Archivo
| Archivo | Cambio |
|---------|--------|
| `nlu.ts` | Reescribir `buildNLUPrompt()` (~lines 41-87) |

