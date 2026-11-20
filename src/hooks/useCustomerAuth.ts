import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Auth del CLIENTE de la PWA.
 * Login primario: Google (OAuth, un toque). Fallback: invitado (anonymous sign-in).
 * El teléfono NO se pide acá: se captura en el checkout (se necesita para el delivery).
 *
 * Requiere en Supabase:
 *   - Provider Google habilitado (Authentication > Providers)
 *   - Anonymous sign-ins habilitado (Authentication > Providers > Anonymous)
 */
export function useCustomerAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /** Login con Google. Redirige y vuelve a `redirectTo` (por defecto, la URL actual). */
  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo ?? window.location.href,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  }, []);

  /** Continuar como invitado (sesión anónima). Puede vincular Google después sin perder el carrito. */
  const continueAsGuest = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }, []);

  /** Un invitado puede vincular su cuenta de Google conservando la misma sesión/datos. */
  const linkGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: redirectTo ?? window.location.href },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    loading,
    isAuthenticated: !!user,
    isGuest: !!user?.is_anonymous,
    signInWithGoogle,
    continueAsGuest,
    linkGoogle,
    signOut,
  };
}
