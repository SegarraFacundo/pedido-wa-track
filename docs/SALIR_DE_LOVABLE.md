# Salir de Lovable e independizar el proyecto

> TL;DR: **ya estás independizado a nivel infraestructura.** Todo vive en servicios tuyos.
> Lovable es sólo un editor con una integración de GitHub. "Salir" = dejar de usarlo,
> sacar lo cosmético y deployar el front vos mismo.

---

## 1. Estado actual (todo ya es tuyo)

| Recurso | Dónde vive | ¿Atado a Lovable? |
|---|---|---|
| **Código** | `github.com/SegarraFacundo/pedido-wa-track` (tu GitHub) | No |
| **Base producción** | Supabase `ilhpiarkmwdjvrfqhyhi` (org tuya, São Paulo) | No |
| **Base staging** | Supabase `tzutvfczbxdmngxsyxss` (org tuya, N. Virginia) | No |
| **Esquema de la base** | `supabase/migrations/` (en el repo) | No |
| **Edge functions** | `supabase/functions/` (repo) + desplegadas en Supabase | No |

Lovable sólo aporta: el editor web, la dependencia `lovable-tagger` y una GitHub App que pushea al repo.

---

## 2. Respaldo de la base (opcional, pero recomendado)

El **esquema completo ya está respaldado en el repo** (`supabase/migrations/`). Lo único que NO
está en Git son: los **datos** (que vas a borrar antes de prod igual), los **secrets** y el
contenido de los **storage buckets**. Aun así, conviene un snapshot antes de tocar nada.

`pg_dump` 17.5 ya está instalado en esta máquina, así que **no hace falta Docker**.

1. En el dashboard: `Settings > Database > Connection string > URI` (usar el **Session pooler**).
   Esa URI **incluye tu contraseña** → corré el comando sólo en tu terminal, no la pegues en el chat.
2. Dump completo (esquema + datos) de producción:

```powershell
pg_dump "PEGÁ_ACÁ_LA_URI_DE_SUPABASE" --no-owner --no-privileges -f "backups/lapacho_prod_$(Get-Date -Format yyyyMMdd).sql"
```

> La carpeta `backups/` está en `.gitignore` (los dumps pueden tener datos, no se commitean).

Alternativa con el CLI (requiere **Docker Desktop corriendo**):
```powershell
npx supabase db dump --linked -f "backups/lapacho_prod.sql"
```

### Lo que NO entra en el dump y hay que recrear si migrás de proyecto
- **Secrets** de las edge functions (tokens de MercadoPago, API keys): `supabase secrets list` para verlos, `supabase secrets set` para cargarlos.
- **Storage buckets**: `product-images`, `vendor-images`, `payment-receipts` (estructura y contenido).

---

## 3. Cortar Lovable del código

1. **Quitar `lovable-tagger`** de `vite.config.ts`:
   - Borrar `import { componentTagger } from "lovable-tagger";`
   - Borrar la línea `mode === 'development' && componentTagger(),` del array `plugins`.
2. Sacarlo de `package.json` (`devDependencies > lovable-tagger`) y `npm install`.
3. Actualizar `README.md` (hoy es el template de Lovable).
4. **Desconectar la GitHub App de Lovable**: en GitHub → `Settings > Applications > Installed GitHub Apps`
   → revocar el acceso de Lovable al repo. Así deja de pushear.

> Nada de esto afecta a Supabase ni a los datos.

---

## 4. Deployar el front por tu cuenta → Cloudflare Pages

Es un SPA de Vite común. Como el **DNS ya está en Cloudflare**, lo más directo es **Cloudflare Pages**
(gratis, se conecta al repo de GitHub y redeploya en cada push). El front todavía lo sirve Lovable
(`pedido-wa-track.lovable.app`), así que esto corta el último cordón.

**Pasos:**
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → repo `SegarraFacundo/pedido-wa-track`.
2. Build settings:
   - Framework preset: **Vite** (o None)
   - Build command: `npm run build`
   - Output directory: `dist`
3. (Opcional) Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
   > No son imprescindibles: hoy están hardcodeadas en `src/integrations/supabase/client.ts`, así que
   > el build funciona igual. Cargarlas es sólo prolijidad.
4. Deploy. Primero probá en la URL `*.pages.dev` que te da Cloudflare.
5. **Custom domains** del proyecto Pages: agregá `lapacho.ar`, `www.lapacho.ar`, `admin.lapacho.ar`,
   `plataforma.lapacho.ar`, `soporte.lapacho.ar`. Al estar el DNS en Cloudflare, es casi un click cada uno.
6. En **Lovable → Dominios**: **desconectar** esos dominios (si no, compiten por el DNS).
7. Verificar que cada subdominio rutea bien (de eso se encarga `SubdomainRouter`).

> **SPA fallback ya resuelto:** el repo incluye `public/_redirects` (`/* /index.html 200`), que Vite
> copia a `dist/`. Sin eso, los links profundos (ej. `/admin`) darían 404 en un host estático.

Las **edge functions** siguen viviendo en Supabase (no se deployan con el front): se actualizan con
`supabase functions deploy`.

---

## 5. Gestionar Supabase directo (sin Lovable)

Ya tenés el CLI logueado y el proyecto linkeado. Flujo normal de ahora en más:
```powershell
npx supabase link --project-ref ilhpiarkmwdjvrfqhyhi   # (ya linkeado)
npx supabase db push                                    # aplicar migraciones
npx supabase functions deploy crear-pedido              # deployar una function
npx supabase secrets set NOMBRE=valor                   # cargar un secret
```

El dashboard (supabase.com) te da todo lo demás: tablas, auth, storage, logs, SQL editor.

---

## 6. Resumen: ¿qué te falta para estar 100% fuera de Lovable?
- [ ] (Opcional) Respaldo de la base con `pg_dump` (sección 2).
- [ ] Quitar `lovable-tagger` + actualizar README (sección 3).
- [ ] Desconectar la GitHub App de Lovable (sección 3).
- [ ] Deployar el front en Vercel/Netlify/Cloudflare (sección 4).
- [ ] (Cuando lances) limpiar datos de prueba y re-setear secrets si hiciera falta.
