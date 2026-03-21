

# Revertir bot a versión pre-traducción (mantener frontend i18n)

## Problema

El bot (`evolution-webhook`) fue modificado extensivamente el 15 de marzo para soportar i18n (4 idiomas). Esto tocó **todos** los archivos del bot: `vendor-bot.ts`, `state-machine.ts`, `bot-helpers.ts`, `tool-handlers.ts`, `nlu.ts`, y se creó `i18n.ts`. Querés volver al bot estable anterior (solo español, sin sistema i18n).

## Enfoque recomendado (2 pasos)

### Paso 1: Revertir todo vía History

Usar el **History** de Lovable para volver a la versión del **15 de marzo antes de las 13:14** (antes del mensaje "Quisiera soportar multiple lenguajes").

Esto revierte TODO el proyecto (bot + frontend) a ese punto estable.

### Paso 2: Re-agregar solo el frontend i18n

Después del revert, re-implementar únicamente el i18n del frontend web (que es mucho más simple que el bot). Esto incluye:

- `src/i18n/index.ts` y los archivos de locales (`es.json`, `en.json`, `pt.json`, `ja.json`)
- `src/components/LanguageSelector.tsx`
- `src/components/LocaleRouter.tsx`
- Integración de `react-i18next` en los componentes de páginas

Estos archivos del frontend son relativamente pocos y se pueden re-crear rápidamente.

## ¿Por qué no revertir manualmente solo el bot?

El bot tiene **8+ archivos** con cientos de cambios entrelazados con el sistema `i18n.ts`. No tengo acceso a las versiones anteriores de esos archivos. Intentar revertir manualmente sería propenso a errores y llevaría mucho más tiempo.

## Acción inmediata

Usá el botón de History para encontrar la versión correcta:

