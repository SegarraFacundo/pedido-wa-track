# Tests para Evolution Webhook

## CI/CD con GitHub Actions

Este proyecto está configurado con GitHub Actions para ejecutar tests automáticamente en cada commit y pull request. El workflow:
- ✅ Ejecuta todos los tests unitarios
- ✅ Genera reportes de cobertura
- ✅ Sube estadísticas a Codecov (opcional)

Ver configuración en `.github/workflows/test.yml`

## Ejecutar Tests Localmente

Para ejecutar los tests unitarios del bot:

```bash
# Ejecutar todos los tests
deno test --allow-env

# Ejecutar tests específicos
deno test utils.test.ts --allow-env
deno test context.test.ts --allow-env
deno test conversation.test.ts --allow-env

# Ejecutar con coverage
deno test --allow-env --coverage=coverage
deno coverage coverage
```

## Estructura de Tests

### `utils.test.ts`
Tests para funciones de utilidad:
- **normalizeArgentinePhone**: Normalización de números telefónicos argentinos
  - Números ya normalizados (549XXXXXXXXX)
  - Números con sufijo WhatsApp (@s.whatsapp.net)
  - Números con diferentes formatos (54X, 9X, 10 dígitos)
  - Números con espacios y símbolos
  - Números con dígitos extra

### `context.test.ts`
Tests para gestión de contexto:
- **getContext**: Carga de contexto desde base de datos
  - Crear nuevo contexto cuando no existe
  - Cargar contexto existente con todos los campos
  - Manejar JSON corrupto gracefully
  - Cargar datos de ubicación correctamente
  
- **saveContext**: Guardado de contexto en base de datos
  - Truncar historial a 20 mensajes
  - No guardar si falta el teléfono
  - Preservar todos los campos del contexto

### `conversation.test.ts` ⭐ **NUEVO: Tests de Integración**
Tests end-to-end que simulan conversaciones completas del bot:
- **Complete conversation flow**: Simula el flujo completo de una orden
  - Usuario selecciona un negocio (ver_menu_negocio)
  - Usuario agrega productos al carrito (agregar_al_carrito)
  - Usuario confirma el pedido
  - Verifica que el contexto persista entre cada paso
  - Valida que `selected_vendor_id` se mantenga
  - Confirma que los items del carrito no se pierdan
  
- **Multiple save/load cycles**: Verifica la persistencia robusta
  - Múltiples ciclos de guardado y carga
  - Agregar items en diferentes momentos
  - Actualizar dirección de entrega
  - Todo debe persistir correctamente
  
- **Empty cart detection**: Detectar carrito vacío correctamente
  - Carrito vacío al inicio
  - Vendor seleccionado pero sin items
  
- **Cart clearing**: Limpiar carrito para nueva orden
  - Iniciar nueva orden limpia el contexto anterior
  - Vendor y cart se resetean correctamente

## Mocks

Los tests usan mocks de Supabase para simular operaciones de base de datos sin conexiones reales.

## Cobertura

Se recomienda mantener al menos 80% de cobertura de código en funciones críticas:
- utils.ts: 100% (funciones puras)
- context.ts: 90%+ (funciones con lógica de negocio)
- conversation flow: 100% (flujos críticos del bot)

## Interpretando los Resultados

### ✅ Tests Pasados
Si ves todos los tests en verde, significa:
- ✅ El contexto se guarda y carga correctamente
- ✅ El carrito persiste entre requests
- ✅ El `selected_vendor_id` se mantiene
- ✅ Los flujos de conversación funcionan end-to-end

### ❌ Tests Fallidos
Si algún test falla, identifica qué parte del flujo está rota:
- **utils.test.ts falla**: Problema con normalización de teléfonos
- **context.test.ts falla**: Problema con persistencia de contexto
- **conversation.test.ts falla**: ⚠️ **CRÍTICO** - El flujo completo está roto
  - Revisa si el contexto se pierde entre llamadas
  - Verifica que `saveContext()` se llame después de cada tool execution
  - Confirma que `getContext()` cargue todos los campos correctamente

## Debugging de Tests

Para ver logs detallados durante los tests:
```bash
# Los tests de conversation.test.ts incluyen logs paso a paso
deno test conversation.test.ts --allow-env

# Verás output como:
# 🧪 TEST: Complete conversation flow
# 📍 Step 1: Initialize conversation
# ✅ Context initialized
# 📍 Step 2: Select vendor and view menu
# ✅ Vendor selected and saved
# ...
```

## Agregar Nuevos Tests

Cuando agregues nuevas funciones:
1. Crea el archivo `[nombre].test.ts` en el mismo directorio
2. Importa las funciones a testear
3. Usa `Deno.test()` para cada caso de prueba
4. Mockea dependencias externas (Supabase, APIs)
5. Actualiza este README

---

## Flujo de Cambio de Negocio con Carrito Activo

**Escenario**: Usuario tiene productos en el carrito de un negocio y quiere ver el menú de otro negocio.

**Flujo correcto**:
1. **Usuario**: "Quiero ver Burger King"
2. **Bot detecta**: Carrito activo de "Pizzería A" con 2 productos ($1000)
3. **Bot pregunta**: 
   ```
   ⚠️ Atención
   
   Tenés 2 productos en el carrito de Pizzería A (Total: $1000).
   
   Si cambias a Burger King, se vaciará tu carrito actual.
   
   ¿Querés cambiar de negocio?
   ✅ Responde "sí" para cambiar
   ❌ Responde "no" para quedarte con tu pedido actual
   ```
4. **Opción A - Usuario confirma**: "Sí"
   - Bot vacía el carrito
   - Bot muestra menú de Burger King
   - Estado: `confirming_vendor_change` → `viewing_menu`
   
5. **Opción B - Usuario cancela**: "No"
   - Bot mantiene el carrito de Pizzería A
   - Bot confirma: "✅ Perfecto, mantenemos tu pedido de Pizzería A"
   - Estado: `confirming_vendor_change` → `adding_items`

**Estados involucrados**:
- `adding_items` → `confirming_vendor_change` → `viewing_menu` (si confirma)
- `adding_items` → `confirming_vendor_change` → `adding_items` (si cancela)

**Validaciones implementadas**:
- ✅ Detección temprana en `ver_menu_negocio`
- ✅ Confirmación explícita del usuario
- ✅ Preservación del carrito si cancela
- ✅ Limpieza segura del carrito si confirma
- ✅ Validación de seguridad en `agregar_al_carrito` para detectar estados inconsistentes

**Tests relacionados**:
- `EDGE CASE: User tries to change vendor with active cart - CONFIRM`
- `EDGE CASE: User tries to change vendor with active cart - CANCEL`
- `EDGE CASE: No confirmation needed when cart is empty`
