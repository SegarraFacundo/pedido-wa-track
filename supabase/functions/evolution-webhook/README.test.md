# Tests para Evolution Webhook

## Ejecutar Tests

Para ejecutar los tests unitarios del bot:

```bash
# Ejecutar todos los tests
deno test --allow-env

# Ejecutar tests específicos
deno test utils.test.ts --allow-env
deno test context.test.ts --allow-env

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

## Mocks

Los tests usan mocks de Supabase para simular operaciones de base de datos sin conexiones reales.

## Cobertura

Se recomienda mantener al menos 80% de cobertura de código en funciones críticas:
- utils.ts: 100% (funciones puras)
- context.ts: 90%+ (funciones con lógica de negocio)

## Agregar Nuevos Tests

Cuando agregues nuevas funciones:
1. Crea el archivo `[nombre].test.ts` en el mismo directorio
2. Importa las funciones a testear
3. Usa `Deno.test()` para cada caso de prueba
4. Mockea dependencias externas (Supabase, APIs)
5. Actualiza este README
