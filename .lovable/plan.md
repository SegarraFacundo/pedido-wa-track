

# Plan: Soporte Multi-idioma (ES, EN, PT, JA)

## Parte 1: Bot de WhatsApp — Auto-detección

### Archivos nuevos
- **`supabase/functions/evolution-webhook/i18n.ts`**: Diccionario con ~30 strings en 4 idiomas (confirmaciones, resúmenes, errores de carrito, labels de menú)

### Archivos a modificar
- **`types.ts`**: Agregar `language?: 'es' | 'en' | 'pt' | 'ja'` a `ConversationContext`
- **`context.ts`**: Persistir y cargar `language`
- **`simplified-prompt.ts`**: Inyectar idioma en el prompt (`"Respondé siempre en {idioma}"`, tono argentino solo para ES)
- **`vendor-bot.ts`**:
  - Función `detectLanguage(text)` con heurísticas (keywords + detección de caracteres japoneses)
  - Reemplazar strings hardcodeados por llamadas al diccionario i18n
  - Expandir regex de confirmación/cancelación/pago para los 4 idiomas

---

## Parte 2: Web — Selector manual (sin auto-detección)

A diferencia del bot, la web **no auto-detecta** el idioma. Default: español. El usuario cambia idioma manualmente con un selector.

### Dependencias nuevas
`react-i18next`, `i18next` (sin `i18next-browser-languagedetector`)

### Archivos nuevos
- **`src/i18n/index.ts`**: Config de i18next con `lng: 'es'` fijo, lee de `localStorage` si existe
- **`src/i18n/locales/es.json`**: Strings en español (~200 keys)
- **`src/i18n/locales/en.json`**: Inglés
- **`src/i18n/locales/pt.json`**: Portugués
- **`src/i18n/locales/ja.json`**: Japonés
- **`src/components/LanguageSelector.tsx`**: Dropdown con banderas/códigos (ES/EN/PT/JA), guarda en `localStorage`

### Archivos a modificar
- **`src/main.tsx`**: Importar `src/i18n/index.ts`
- **`src/pages/Landing.tsx`**: Reemplazar strings con `t('key')`, agregar `LanguageSelector` al header
- Resto de páginas (Términos, Privacidad, Contacto, Auth, Dashboards) — migrar progresivamente

### Comportamiento
1. Primera visita → español
2. Usuario cambia a EN → se guarda en `localStorage('i18n_lang')`
3. Próximas visitas → lee de `localStorage`, mantiene la elección
4. Sin detección de idioma del navegador

---

## Fases de implementación

1. **Fase 1**: Bot (detección + i18n + prompt) + Landing.tsx con selector manual
2. **Fase 2**: Resto de páginas web

