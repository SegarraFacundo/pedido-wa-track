

# Plan: Corregir que el bot muestra el menú en loop en vez de agregar al carrito

## Problema identificado

Cuando el usuario está en estado `shopping` y dice "2", "2 remeras", "1 remera", etc., el LLM llama `ver_menu_negocio` en vez de `agregar_al_carrito`. Como `ver_menu_negocio` está en `DIRECT_RESPONSE_TOOLS`, se retorna el menú directamente sin darle chance al LLM de corregirse. Resultado: loop infinito de menús.

Los logs confirman: `Tool ver_menu_negocio → DIRECT RESPONSE` cada vez que el usuario intenta agregar productos.

## Causa raíz

1. En estado `shopping`, tanto `ver_menu_negocio` como `agregar_al_carrito` están disponibles
2. El LLM con `tool_choice: "required"` + `temperature: 0` elige `ver_menu_negocio` porque ve un número y piensa que el usuario quiere ver un negocio
3. `DIRECT_RESPONSE_TOOLS` cortocircuita la respuesta, impidiendo que el LLM corrija su error

## Solución: 3 cambios en `vendor-bot.ts`

### Cambio 1: Interceptor determinista para shopping + número/producto

Antes del LLM, agregar un interceptor que detecte cuando el usuario en estado `shopping` envía:
- Un número solo ("2") → interpretar como "producto #2 del menú, cantidad 1"
- Número + nombre de producto ("2 remeras") → interpretar como "cantidad 2 del producto que matchee 'remeras'"

Este interceptor buscará el producto en la DB del vendor actual y llamará `agregar_al_carrito` directamente, sin pasar por el LLM.

### Cambio 2: Quitar `ver_menu_negocio` de DIRECT_RESPONSE_TOOLS cuando está en shopping

O mejor: cuando el estado es `shopping`, si el LLM llama `ver_menu_negocio` pero ya tiene el menú cargado (ya está en shopping = ya vio el menú), bloquear la llamada y forzar que el LLM use `agregar_al_carrito` con un mensaje de error en el tool result.

### Cambio 3: Interceptor para mensajes multi-intención

"2 remeras quiero y enviamelo a Av. Villada 1582 y pago en efectivo" combina 3 intenciones. El interceptor parseará esto y ejecutará secuencialmente:
1. `agregar_al_carrito` con cantidad 2 del producto que matchee
2. `confirmar_direccion_entrega` con "Av. Villada 1582"  
3. `seleccionar_metodo_pago` con "efectivo"

## Archivos a modificar

- `supabase/functions/evolution-webhook/vendor-bot.ts`:
  - Agregar interceptor shopping + número/producto (después de línea ~3625, antes del LLM)
  - Agregar lógica de bloqueo de `ver_menu_negocio` redundante en shopping
  - Agregar interceptor multi-intención básico

## Detalle técnico del interceptor shopping

```text
Estado: shopping + selected_vendor_id existente
Input: "2" → buscar producto #2 del vendor en DB → agregar_al_carrito({product_id, product_name, quantity: 1, price})
Input: "2 remeras" → parsear cantidad=2, buscar "remeras" en productos del vendor → agregar_al_carrito
Input: "quiero 3 pizzas" → parsear cantidad=3, buscar "pizza" → agregar_al_carrito
```

El interceptor consultará `products` de Supabase filtrando por `vendor_id` para resolver el nombre/número a un producto real, evitando completamente que el LLM invente datos.

