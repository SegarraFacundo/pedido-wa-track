
# Plan: Forzar Consulta de Menú Actualizado cuando el Usuario lo Pide

## Resumen del Problema

El bot está mostrando menús desactualizados porque cuando el usuario pide "ver el menú de nuevo", la IA usa el menú del historial de conversación en lugar de llamar a `ver_menu_negocio` para obtener los productos actualizados de la base de datos.

**Evidencia del log:**
```
✅ No tool calls - AI responding with text
```
Cuando el usuario pidió "Quiero ver el menu de nuevo", la IA respondió con texto del historial SIN llamar a la herramienta.

---

## Causa Raíz

En `simplified-prompt.ts` líneas 374-377:
```
- Si el usuario tiene un negocio seleccionado y pide agregar productos, NO vuelvas a pedir el menú
- Solo llamá ver_menu_negocio si el usuario explícitamente pide ver OTRO negocio diferente
```

Esta instrucción fue diseñada para evitar repetir el menú innecesariamente, pero tiene un efecto secundario: bloquea la actualización del menú cuando el usuario lo pide explícitamente.

---

## Solución Propuesta

Modificar el prompt para diferenciar entre:
1. **Pedir agregar productos** = No mostrar menú de nuevo (comportamiento actual)
2. **Pedir VER el menú de nuevo** = SIEMPRE llamar a `ver_menu_negocio` para obtener datos frescos

---

## Cambio Principal

### Archivo: `supabase/functions/evolution-webhook/simplified-prompt.ts`

**Reemplazar sección de "Continuidad de Pedidos" (líneas 373-378):**

Antes:
```
💡 IMPORTANTE - Continuidad de Pedidos:
- Si el usuario tiene un negocio seleccionado y pide agregar productos, NO vuelvas a pedir el menú
- USA el vendor_id que ya está en el contexto
- Solo llamá ver_menu_negocio si el usuario explícitamente pide ver OTRO negocio diferente
- Si hay carrito con productos, el usuario puede seguir agregando del mismo negocio sin volver a elegir
5. Si el usuario no entendió, reformulá la respuesta, NO vuelvas a ejecutar la herramienta
```

Después:
```
💡 IMPORTANTE - Continuidad de Pedidos:
- Si el usuario tiene un negocio seleccionado y pide agregar productos, NO vuelvas a pedir el menú
- USA el vendor_id que ya está en el contexto
- Si hay carrito con productos, el usuario puede seguir agregando del mismo negocio sin volver a elegir

🔄 EXCEPCIÓN CRÍTICA - Actualización de Menú:
- Si el usuario pide EXPLÍCITAMENTE ver el menú de nuevo ("ver menú", "mostrar menú", "menú de nuevo", "actualizar menú", "ver productos"):
  → SIEMPRE llamá ver_menu_negocio con el vendor_id actual
  → NUNCA uses el menú del historial de conversación
  → El menú puede haber cambiado (productos nuevos, precios, stock)
  → El usuario espera ver datos FRESCOS de la base de datos

5. Si el usuario no entendió, reformulá la respuesta, NO vuelvas a ejecutar la herramienta
```

---

## Por Qué Esto Funciona

| Situación | Comportamiento Anterior | Comportamiento Nuevo |
|-----------|------------------------|---------------------|
| Usuario: "agregame 2 pizzas" | No muestra menú (OK) | No muestra menú (OK) |
| Usuario: "ver menú" (mismo negocio) | Usa menú del historial (MAL) | Llama ver_menu_negocio (CORRECTO) |
| Usuario: "ver menú de Pizza House" (otro negocio) | Llama ver_menu_negocio (OK) | Llama ver_menu_negocio (OK) |

---

## Impacto

- **Archivos modificados**: 1 (`simplified-prompt.ts`)
- **Líneas cambiadas**: ~10
- **Riesgo**: Bajo (solo agrega una excepción clara)
- **Requiere deploy**: Sí (edge function)
- **Resultado esperado**: Cuando el usuario pida "ver el menú", siempre verá los productos actualizados de la BD

---

## Sección Técnica

### Orden de Implementación
1. Modificar `simplified-prompt.ts` con la nueva instrucción
2. Deploy de la edge function `evolution-webhook`
3. Probar agregando un producto y pidiendo el menú de nuevo

### Verificación Post-Implementación
- Agregar un producto nuevo desde el dashboard del vendor
- Pedir "ver el menú" por WhatsApp
- Verificar que el producto nuevo aparece
- Verificar en logs que `ver_menu_negocio` fue llamado (no "No tool calls")
