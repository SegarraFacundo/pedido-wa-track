

# Plan: Sistema QA Automatizado para el Bot

## Resumen

Construir un sistema de testing QA integrado en el admin que use IA (Lovable AI Gateway) para generar casos de prueba automaticamente, ejecutarlos contra el bot real, y almacenar resultados para mejora continua.

## Arquitectura

```text
┌─────────────────────────────────────────────┐
│  Admin Panel - Tab "QA Bot"                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Generar  │  │ Ejecutar │  │ Historial │ │
│  │ Tests    │  │ Tests    │  │ Resultados│ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│       │              │              │       │
│       ▼              ▼              ▼       │
│  Edge Fn:       BotTester       Supabase    │
│  generate-qa    (reuse logic)   bot_qa_*    │
│  (Lovable AI)                   tables      │
└─────────────────────────────────────────────┘
```

## Componentes

### 1. Edge Function: `generate-qa-tests`
- Usa Lovable AI Gateway con el prompt QA del usuario
- Recibe parametros: cantidad de tests, tipo (basico/edge/real), tests existentes para evitar duplicados
- Retorna JSON con array de test cases
- Modo "evolucion": recibe tests previos + logs de errores reales, genera tests mas complejos

### 2. Tabla Supabase: `bot_qa_tests`
- `id`, `name`, `category` (basic/edge/real_users), `steps` (jsonb array de mensajes), `created_at`, `source` (ai_generated/manual/real_user)
- Persistencia de todos los casos generados

### 3. Tabla Supabase: `bot_qa_results`
- `id`, `test_id` (FK), `run_at`, `status` (passed/failed/error), `steps_results` (jsonb con mensaje enviado + respuesta recibida por cada paso), `notes`

### 4. Componente: `BotQATester` (nueva tab en Admin)
- **Generar**: Boton que llama a `generate-qa-tests`, muestra preview, permite guardar
- **Tests guardados**: Lista de tests con filtro por categoria, boton para ejecutar individual o batch
- **Ejecutar**: Reutiliza la logica del BotTester (invoke evolution-webhook con phone `qa_test_X`), ejecuta cada step secuencialmente, guarda respuestas
- **Resultados**: Timeline de ejecuciones con estado pass/fail, detalle expandible de cada paso
- **Evolucion**: Boton "Generar tests mas dificiles" que envia tests existentes + errores reales al prompt de evolucion
- **Importar errores reales**: Boton que toma interacciones de `bot_interaction_logs` con errores y las convierte en test cases

### 5. Tab en Admin
- Agregar "QA Bot" con icono TestTube al menu del admin, junto a "Errores Bot"

## Flujo de uso

1. Admin clickea "Generar Tests" → IA genera 10+ casos → se muestran en preview
2. Admin revisa, descarta los que no aplican, guarda el resto
3. Admin clickea "Ejecutar todos" → el sistema corre cada test contra el bot real
4. Resultados se muestran con pass/fail → los fails se pueden analizar
5. Admin puede marcar "No es necesario corregir" o "Requiere fix" en cada resultado
6. Periodicamente, clickea "Evolucionar tests" → la IA genera casos mas complejos basados en historial

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/generate-qa-tests/index.ts` | Crear - Edge function con Lovable AI |
| `supabase/migrations/XXXX_bot_qa_tables.sql` | Crear - Tablas bot_qa_tests y bot_qa_results |
| `src/components/admin/BotQATester.tsx` | Crear - Componente principal QA |
| `src/pages/Admin.tsx` | Modificar - Agregar tab QA |

