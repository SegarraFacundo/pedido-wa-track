

# Plan: Redesplegar la versión del repositorio (amigable) al edge function

## Problema

La versión desplegada en producción tiene un sistema NLU diferente al código del repositorio. Los logs muestran:
- `🧠 NLU Result: intent=add_to_cart, confidence=0.9` — este NLU no existe en el código actual del repo
- El NLU clasifica correctamente ("add_to_cart") pero luego la lógica no lo maneja bien y cae en "Perdón, no entendí"

El código del repositorio usa OpenAI function-calling con interceptores deterministas, que es la versión "amigable" que el usuario quiere restaurar.

## Solución

**Redesplegar la edge function `evolution-webhook`** desde el código actual del repositorio. No se necesitan cambios de código — solo un redespliegue.

## Resultado esperado

- El bot vuelve a usar el sistema de function-calling con interceptores deterministas
- Respuestas amigables con emojis y opciones numeradas
- Shopping interceptor funcional (agregar productos con "2", "2 remeras", etc.)
- Multi-intent parsing ("2 remeras a Av. Villada 1582 pago en efectivo")
- Sin fallbacks genéricos tipo "Perdón, no entendí"

