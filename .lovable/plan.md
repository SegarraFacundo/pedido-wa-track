

# Analisis: Donde la IA toma decisiones vs donde deberia haber logica determinista

## Resumen del problema

Tu bot tiene una arquitectura **hibrida**: ~40% de los flujos ya son deterministas (codigo hardcodeado con regex/if-else que intercepta ANTES de llegar al LLM), y ~60% depende de que GPT-4o-mini "entienda" instrucciones en un prompt de ~430 lineas. Ese 60% es donde ocurren los problemas.

---

## Lo que YA esta bien (flujos programaticos existentes)

Estos flujos **nunca pasan por el LLM** y funcionan de forma confiable:

```text
INTERCEPTORES DETERMINISTAS (codigo en vendor-bot.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Confirmacion post-resumen (lineas 3117-3138) → regex detecta "si/dale/ok" → crear_pedido directo
✅ Seleccion de metodo de pago (lineas 3315-3410) → regex detecta "1/2/efectivo/mp" → guarda y crea pedido
✅ Confirmacion transferencia (lineas 3414-3500) → regex detecta "si/no" → cambia estado
✅ Cambio de negocio (lineas 2981-3051) → regex detecta "si/no" → aplica/rechaza cambio
✅ Cancelacion programatica (lineas 3054-3111) → flujo de 2 pasos con regex
✅ Bloqueo pedido duplicado (lineas 2942-2971) → detecta keywords y bloquea
✅ Carrito vacio al confirmar (lineas 3203-3292) → valida context.cart.length
✅ Comprobante recibido (lineas 2907-2931) → detecta imagen → guarda en DB
✅ Link MercadoPago (lineas 3141-3201) → detecta keywords → genera link
✅ Stale order cleanup (context.ts lineas 24-63) → auto-cancela pedidos >4h
```

---

## Lo que DEPENDE del LLM y falla (zonas de riesgo)

### 1. **Interpretacion de intenciones del usuario** (RIESGO ALTO)
El LLM decide QUE herramienta llamar basandose en el prompt. Esto causa:
- Usuario dice "quiero una coca" → LLM puede inventar que hay coca sin llamar `buscar_productos`
- Usuario dice "1" en estado shopping → LLM puede interpretarlo como "negocio 1" en vez de "producto 1"
- Usuario da una direccion → LLM puede no llamar `confirmar_direccion_entrega`

**Solucion propuesta**: Agregar mas interceptores con regex ANTES del LLM:
- Detectar patrones de direccion (calle + numero) → llamar `confirmar_direccion_entrega` directamente
- En estado `needs_address`, TODO lo que no sea "cancelar" se trata como direccion
- En estado `checkout`, numeros "1/2/3" SIEMPRE se mapean a metodos de pago (ya esta parcialmente)

### 2. **Formato y contenido de respuestas** (RIESGO MEDIO)
El prompt dice "se breve", "no digas Aqui tenes", etc., pero el LLM a veces:
- Agrega introducciones innecesarias
- Reformatea menus que ya vienen formateados
- Inventa datos del historial en vez de llamar herramientas

**Solucion propuesta**: Los mensajes de respuesta para herramientas clave ya estan hardcodeados en `ejecutarHerramienta`. El LLM solo deberia "pasar" esos resultados. Se podria forzar que en ciertos estados, si el tool devuelve texto, se retorne directamente sin dejar que el LLM lo reformatee.

### 3. **El prompt es demasiado largo y contradictorio** (RIESGO ALTO)
`simplified-prompt.ts` tiene 433 lineas con reglas que se repiten y a veces se contradicen:
- "NUNCA llames ver_menu_negocio mas de una vez" (repetido 3 veces en distintas secciones)
- Reglas de estado que incluyen instrucciones para TODOS los estados aunque solo uno aplica
- El prompt crece con cada fix (parche sobre parche)

**Solucion propuesta**: Reducir el prompt a <100 lineas. Mover TODA la logica de validacion a codigo. El prompt solo deberia decir: "Sos un vendedor amigable. Usa las herramientas disponibles. Se breve."

### 4. **Herramientas que la IA no deberia tener en ciertos estados** (RIESGO MEDIO)
Ya hay filtrado parcial (linea 3567-3570, solo filtra `ver_locales_abiertos` en shopping), pero deberia ser mucho mas agresivo:

```text
ESTADO          HERRAMIENTAS PERMITIDAS (el resto se bloquea)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
idle            buscar_productos, ver_locales_abiertos, mostrar_menu_ayuda
browsing        ver_menu_negocio, buscar_productos, ver_locales_abiertos
shopping        agregar_al_carrito, quitar_producto_carrito, ver_carrito,
                modificar_carrito_completo, ver_menu_negocio, ver_ofertas,
                seleccionar_tipo_entrega, confirmar_direccion_entrega,
                ver_metodos_pago, seleccionar_metodo_pago,
                mostrar_resumen_pedido, vaciar_carrito
needs_address   confirmar_direccion_entrega, vaciar_carrito
checkout        seleccionar_metodo_pago, mostrar_resumen_pedido, crear_pedido
order_pending_* ver_estado_pedido, cancelar_pedido, hablar_con_vendedor
                registrar_calificacion, calificar_plataforma
```

### 5. **El "menu de ayuda" es generado por el LLM** (RIESGO BAJO)
`mostrar_menu_ayuda` es una herramienta, pero el LLM decide que decir. Deberia retornar un texto fijo.

---

## Plan de implementacion (ordenado por impacto)

### Fase 1: Filtrado agresivo de herramientas por estado
- Modificar `vendor-bot.ts` (lineas 3564-3570) para implementar la tabla de arriba
- Esto elimina ~50% de las alucinaciones porque el LLM simplemente NO PUEDE llamar herramientas incorrectas

### Fase 2: Mas interceptores deterministas pre-LLM
- Estado `needs_address`: todo texto que no sea "cancelar/cambiar/volver" → `confirmar_direccion_entrega`
- Estado `idle`/`browsing` + mensaje con palabras de comida → `buscar_productos` directo sin LLM
- Estado `shopping` + numero solo ("1", "2") → interpretar como producto, no como negocio

### Fase 3: Reducir el prompt drasticamente
- Eliminar reglas duplicadas
- Eliminar instrucciones de estados que no aplican (ya se hace con condicionales, pero hay mucho texto compartido)
- Objetivo: <150 lineas totales

### Fase 4: Respuestas directas sin reformateo del LLM
- Cuando `ejecutarHerramienta` retorna texto para `ver_locales_abiertos`, `ver_menu_negocio`, `ver_carrito`, `mostrar_resumen_pedido` → retornar directamente sin pasar por el LLM para "resumir"
- Esto se logra con un flag `directResponse` en el resultado de la herramienta

### Fase 5: Menu de ayuda estatico
- Reemplazar la herramienta `mostrar_menu_ayuda` por un texto fijo hardcodeado que se retorna directamente

---

## Metricas de impacto esperado

```text
Fase 1 (filtro herramientas)  → Elimina: cambios accidentales de negocio,
                                 crear_pedido sin datos, mezcla de menus
Fase 2 (interceptores)        → Elimina: LLM ignorando direcciones,
                                 confundiendo numeros, no llamando tools
Fase 3 (prompt reducido)      → Elimina: instrucciones contradictorias,
                                 confusion por exceso de reglas
Fase 4 (respuestas directas)  → Elimina: reformateo de menus, agregar
                                 texto innecesario, inventar datos
Fase 5 (ayuda estatica)       → Elimina: respuestas inconsistentes de ayuda
```

¿Aprobas el plan? Puedo implementar las 5 fases en orden, empezando por la Fase 1 que es la de mayor impacto.

