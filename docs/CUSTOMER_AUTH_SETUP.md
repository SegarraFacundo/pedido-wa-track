# Configuración del auth del cliente (Google + invitado)

Login de la PWA del cliente: **Google (OAuth)** + **invitado (anonymous sign-in)**.
Código ya listo: `src/hooks/useCustomerAuth.ts` y `src/components/customer/CustomerLogin.tsx`.
Falta sólo la **configuración de dashboard** (no se hace por código).

---

## 1. Supabase — Anonymous sign-ins (invitado)
`Authentication > Sign In / Providers > Anonymous Sign-Ins` → **Enable**.
> Nota: cada invitado crea un `auth.users` anónimo. Conviene limpiarlos periódicamente
> (ej: borrar anónimos sin pedidos y con > X días). Dejar para la etapa de prod.

## 2. Google Cloud — credenciales OAuth
1. [console.cloud.google.com](https://console.cloud.google.com) → crear/elegir proyecto.
2. `APIs & Services > OAuth consent screen` → configurar (External), agregar dominio y datos.
3. `APIs & Services > Credentials > Create credentials > OAuth client ID` → tipo **Web application**.
4. **Authorized JavaScript origins**: el dominio de la PWA (ej. `https://lapacho.ar`) y `http://localhost:5173` para dev.
5. **Authorized redirect URIs**:
   ```
   https://ilhpiarkmwdjvrfqhyhi.supabase.co/auth/v1/callback
   ```
6. Copiar **Client ID** y **Client Secret**.

## 3. Supabase — provider Google
`Authentication > Sign In / Providers > Google` → **Enable** y pegar **Client ID** + **Client Secret**.

## 4. Supabase — URLs de redirección
`Authentication > URL Configuration`:
- **Site URL**: dominio de la PWA (ej. `https://lapacho.ar`).
- **Redirect URLs**: agregar el dominio de prod y `http://localhost:5173/**` (dev).
  El código usa `redirectTo = window.location.href`, así que la URL actual debe estar permitida
  (alcanza con los patrones `https://lapacho.ar/**` y `http://localhost:5173/**`).

---

## Cómo se usa en el código
```tsx
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { CustomerLogin } from "@/components/customer/CustomerLogin";

// Gate antes del checkout:
const { isAuthenticated } = useCustomerAuth();
if (!isAuthenticated) return <CustomerLogin />;
```
- `signInWithGoogle()` → redirige a Google y vuelve.
- `continueAsGuest()` → sesión anónima, sin salir de la app.
- `linkGoogle()` → un invitado vincula Google después, conservando carrito/sesión.
- El **teléfono** se pide en el checkout (lo necesita `crear-pedido`), no en el login.
