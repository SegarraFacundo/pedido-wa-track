# Migrar transcripción de audio e imágenes de producto al Lovable AI Gateway

Las dos funciones que aún llaman directo a OpenAI dejan de depender de esa cuenta y pasan por el Lovable AI Gateway, igual que ya hace el bot.

## Qué cambia

### 1. Transcripción de audios de WhatsApp (`transcribe-audio`)
- La llamada a `api.openai.com/v1/audio/transcriptions` se reemplaza por el endpoint de speech-to-text del Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/audio/transcriptions`), autenticado con `LOVABLE_API_KEY` en el header `Lovable-API-Key`.
- Se mantiene el mismo contrato: recibe `{ audio, mimeType }` en base64 y devuelve `{ text }`, así el bot y el AudioRecorder no cambian.
- Se mantiene el idioma español y la detección de extensión por MIME type.
- Si `LOVABLE_API_KEY` no existe, cae al camino OpenAI actual (mismo patrón que el bot).
- Errores 429 (límite) y 402 (créditos agotados) se devuelven con mensaje claro en vez de un 500 genérico.

### 2. Generación de imágenes de producto (`generate-product-images`)
- La llamada a `gpt-image-1` de OpenAI se reemplaza por generación de imágenes del Lovable AI Gateway, con el mismo prompt de foto de producto sobre fondo blanco.
- El resto del flujo queda igual: base64 → subida a Storage `product-images` → alta del producto en la tabla `products` → resumen de éxitos/fallos.
- Fallback a OpenAI si no hay `LOVABLE_API_KEY`, y manejo explícito de 429/402.

## Verificación
- Llamar `transcribe-audio` con un audio corto y confirmar que devuelve texto.
- Llamar `generate-product-images` con un producto de prueba y confirmar que la imagen se sube y el producto se crea.
- Revisar logs de ambas funciones para confirmar que el proveedor usado es el gateway.

## Notas técnicas
- `LOVABLE_API_KEY` ya está configurada en el proyecto; no hace falta pedir nada al usuario.
- Ninguna de las dos funciones cambia su interfaz de entrada/salida, por lo que no hay cambios en el frontend (`AudioRecorder.tsx`, `PharmacyProductLoader.tsx`).
- Se mantienen los headers CORS actuales.
