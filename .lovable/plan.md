
# Plan de Limpieza del Repositorio

## Resumen

He analizado todo el código y encontré varios archivos, componentes y datos de prueba que no se utilizan en ninguna parte del proyecto y pueden eliminarse de forma segura para mantener el repositorio mas limpio y entendible.

---

## Archivos a Eliminar

### 1. Archivos de Datos Mock (No usados)

| Archivo | Motivo |
|---------|--------|
| `src/data/mockData.ts` | Define `mockVendors`, `mockOrders` y `mockMessages` pero ninguno de estos exports se importa en otro archivo del proyecto. El proyecto usa datos reales de Supabase. |

### 2. Componentes No Usados

| Archivo | Motivo |
|---------|--------|
| `src/components/VendorDashboard.tsx` | No se importa en ningun lugar. El proyecto usa `VendorDashboardWithRealtime.tsx` en su lugar (que tiene la misma funcionalidad pero con realtime). |
| `src/components/PaymentManager.tsx` | No se importa en ningun lado del codigo. Las funciones de pago se manejan directamente en `OrderCard.tsx`. |

### 3. Contextos No Usados

| Archivo | Motivo |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Define `AuthProvider` y `useAuth` pero nunca se importa ni se usa. La autenticacion se maneja directamente con el cliente de Supabase en cada componente. |

### 4. Scripts de Desarrollo

| Archivo | Motivo |
|---------|--------|
| `src/scripts/createLapachoUser.ts` | Script de una sola vez para crear un usuario de prueba. Tiene credenciales hardcodeadas y se auto-ejecuta al importarse. No deberia estar en produccion. |

### 5. Archivos CSS Obsoletos

| Archivo | Motivo |
|---------|--------|
| `src/App.css` | Contiene estilos de la plantilla inicial de Vite (`.logo`, `.read-the-docs`, etc.) que no se usan. Todo el proyecto usa Tailwind CSS via `index.css`. |

### 6. Carpeta de Datos

| Carpeta | Motivo |
|---------|--------|
| `src/data/` | Toda la carpeta puede eliminarse ya que solo contiene `mockData.ts` que no se usa. |

### 7. Carpeta de Scripts

| Carpeta | Motivo |
|---------|--------|
| `src/scripts/` | Toda la carpeta puede eliminarse ya que solo contiene `createLapachoUser.ts` que no se usa. |

---

## Archivos que SI se Conservan

Estos archivos parecen candidatos a eliminar pero realmente se usan:

| Archivo | Razon para mantener |
|---------|---------------------|
| `src/lib/paymentValidation.ts` | Usado en `OrderCard.tsx` y `PaymentManager.tsx` |
| `src/hooks/useNotificationPermission.ts` | Usado en `NotificationCenter.tsx` y `useVendorNotifications.ts` |
| `src/hooks/useVendorNotifications.ts` | Usado en `NotificationCenter.tsx` |
| `docker-compose.yaml` | Documentado en las guias de deploy para Evolution API |
| `production_initial_migration.sql` | Archivo de referencia para nuevas instancias de produccion |
| `public/brand/*` | Usado en `BrandAssets.tsx` |
| `src/tailwind.config.lov.json` | Archivo interno de Lovable (no tocar) |

---

## Impacto

- **Archivos eliminados**: 6 archivos + 2 carpetas vacias
- **Lineas de codigo eliminadas**: Aproximadamente 420 lineas
- **Riesgo**: Ninguno (ningun archivo tiene dependencias)

---

## Seccion Tecnica

### Orden de Eliminacion Recomendado

1. Eliminar primero los archivos individuales
2. Luego eliminar las carpetas vacias

### Verificacion Post-Limpieza

Despues de eliminar, verificar que:
- El build de TypeScript compila sin errores
- La aplicacion funciona correctamente en preview
- Los tests de edge functions siguen pasando

