# Bajar la tasa de equivocación del bot hacia 0

El bot no falla por "el modelo": falla porque le damos poco contexto y porque hay reglas rígidas (regex) que ganan antes que el razonamiento. Estos son los cambios, ordenados por impacto real.

## 1. Darle memoria útil al modelo (impacto alto)

Hoy el modelo ve entre 1 y 6 mensajes, y encima se le borran los mensajes que contienen menús. Con eso, si le mostraste la heladería y decís "el segundo", el modelo no tiene la lista.

Cambios:
- Subir el historial a 12 turnos en todos los estados.
- Dejar de borrar los menús del historial. En vez de borrarlos, reemplazarlos por un resumen compacto y estructurado del tipo:
  `[Menú mostrado — Heladería Italiana: 1=Chocolate $2500, 2=Dulce de leche $2500, 3=Limón $2300]`
  Así el modelo puede resolver "el 2" o "el de dulce de leche" sin alucinar precios.
- Guardar en la sesión el último listado mostrado (`last_shown_list`: tipo, negocio, items con índice) y meterlo en el prompt como dato duro, no como texto de chat.

## 2. Estado explícito en el prompt, no implícito

Agregar al bloque SITUACIÓN ACTUAL:
- Última lista mostrada y a qué negocio pertenece.
- Qué dato exacto está esperando el bot ahora (dirección / pago / confirmación) en una sola línea imperativa.
- Carrito con notas incluidas.

## 3. Ordenar los interceptores por prioridad, no por posición

Hoy hay una cadena larga de `if` con regex y gana el primero que matchea. Por eso "confirmo el pedido" se tomó como dirección.

Cambios:
- Un único punto de resolución: primero se evalúan los comandos de escape (cancelar, reiniciar, ayuda, hablar con humano), después los interceptores que corresponden **al estado actual**, y recién ahí el resto.
- Un interceptor que no pertenece al estado actual no corre. Ejemplo: el interceptor de dirección solo existe en `needs_address`.

## 4. Confirmaciones que no dependen de adivinar

En los pasos críticos (dirección, pago, confirmar pedido) el bot repite el dato entendido y pide un sí/no antes de avanzar:
- "Anoté: *Av. Rivadavia 1234*. ¿Está bien? (sí / corregir)"
Un paso más, pero elimina la clase entera de errores del tipo "la confirmación quedó como dirección".

## 5. Menos margen para inventar

- Bajar `temperature` a 0.2 en el llamado al modelo (hoy queda en el default).
- Reforzar en el prompt: si el usuario menciona un producto que no está en la última lista, preguntar, nunca asumir.

## 6. Medir para saber si baja de verdad

- Guardar en cada turno: estado, interceptor que ganó (o "LLM"), herramienta ejecutada, y si el usuario en el turno siguiente corrigió o repitió.
- Con eso se ve en qué estado y con qué interceptor se rompe, en vez de depender de capturas de WhatsApp.

## Notas técnicas

Archivos afectados, todos en `supabase/functions/evolution-webhook/`:
- `vendor-bot.ts` — historial (líneas ~1708-1731), temperatura, orden de interceptores, logging por turno.
- `simplified-prompt.ts` — bloque de situación, última lista, dato esperado, regla anti-invención.
- `types.ts` / `context.ts` — campo `last_shown_list` en el contexto de sesión.
- `shopping-interceptor.ts` — interceptores condicionados al estado.

Los tests existentes (`conversation.test.ts`) sirven de red de seguridad; se agregan casos para los escenarios que ya fallaron: "ver menú" con un solo vendor, "confirmo el pedido" en `needs_address`, y nota sobre producto ya en carrito.

## Orden sugerido

1 y 2 primero (es donde está la mayor parte del error), después 3, y 4-6 al final.
