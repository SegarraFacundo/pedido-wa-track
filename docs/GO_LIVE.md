# Puesta en vivo — PWA del cliente

> Objetivo: que `lapacho.ar/es/tienda` sirva la nueva tienda del cliente y tome pedidos de punta a punta.
> Estado actual: código en `main` (local), backend ya deployado en Supabase (migraciones + 6 edge functions).

Seguí los pasos **en orden**. Probá siempre en una URL de prueba **antes** de tocar los dominios (cero downtime).

---

## 1. Subir el código a GitHub (push)
Cloudflare Pages construye desde el repo, así que primero hay que pushear lo commiteado.
```powershell
git push origin main
```
> Ojo: mientras Lovable siga conectado al repo, el push también dispara un build en Lovable. No hay problema; es sólo un mirror.

## 2. Supabase — activar el login
`Authentication → Sign In / Providers`:
- **Anonymous Sign-Ins → Enable**  ← imprescindible para el checkout como invitado.
- (Opcional) **Google → Enable** con las credenciales OAuth (ver `docs/CUSTOMER_AUTH_SETUP.md`).

## 3. Cloudflare Pages — deploy del front
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → repo `SegarraFacundo/pedido-wa-track`, rama `main`.
2. Build settings:
   - Framework preset: **Vite** (o None)
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Deploy** y probá en la URL `*.pages.dev` que te da Cloudflare:
   - `https://<tu-proyecto>.pages.dev/es/tienda` → deberías ver los negocios.
   - Hacé un **pedido de prueba** completo (como invitado) para validar checkout + seguimiento.
> El `public/_redirects` ya está en el repo, así que los links profundos (`/es/pedido/…`) no dan 404.

## 4. Pasar los dominios de Lovable a Pages
Recién cuando el `*.pages.dev` funcione:
1. En **Cloudflare Pages → tu proyecto → Custom domains**, agregá: `lapacho.ar`, `www.lapacho.ar`, `admin.lapacho.ar`, `plataforma.lapacho.ar`, `soporte.lapacho.ar`.
   (El DNS ya está en Cloudflare, así que es casi un click por dominio.)
2. En **Lovable → Settings → Dominios**, **desconectá** esos mismos dominios (si no, compiten por el DNS).

## 5. Verificación final en vivo
- `https://lapacho.ar/es/tienda` → tienda del cliente.
- `https://plataforma.lapacho.ar` → panel del vendedor (sigue funcionando).
- Pedido de prueba de punta a punta: crear → seguir (realtime) → cancelar / calificar.
- Borrar el pedido/ticket de prueba antes de abrir al público.

---

## Notas
- **Backend**: ya está vivo (migraciones + funciones en Supabase `ilhpiarkmwdjvrfqhyhi`). No hay que hacer nada ahí salvo el toggle del paso 2.
- **Migraciones futuras**: `supabase db push --remote` ya funciona (historial reconciliado).
- **Pendientes opcionales**: web-push real (app cerrada), pago MercadoPago embebido (hoy funciona por redirección).
- **Limpieza pre-público**: borrar datos de prueba (`docs/SALIR_DE_LOVABLE.md` §7 tiene el checklist).
