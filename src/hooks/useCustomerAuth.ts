import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/** URL actual SIN hash: evita el "##access_token" que rompe el login al volver del magic link/OAuth. */
const currentUrlNoHash = () =>
  window.location.origin + window.location.pathname + window.location.search;

/**
 * Auth del CLIENTE de la PWA.
 * Login OBLIGATORIO: Google (OAuth, un toque) o email (magic link, sin contraseña).
 * No hay modo invitado: toda orden queda atada a una cuenta identificable.
 * El teléfono NO se pide acá: se captura en el checkout (se necesita para el delivery).
 *
 * Requiere en Supabase:
 *   - Provider Google habilitado (Authentication > Providers)
 *   - Provider Email habilitado (Authentication > Providers > Email) — ya lo usan los paneles
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
        redirectTo: redirectTo ?? currentUrlNoHash(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  }, []);

  /**
   * Login/registro con email vía magic link (sin contraseña).
   * Crea la cuenta si no existe y manda un enlace al correo. Al abrirlo, queda logueado.
   */
  const signInWithEmailOtp = useCallback(async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo ?? currentUrlNoHash(),
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }, []);

  /** Continuar como invitado (sesión anónima). Se mantiene sólo para el chat de soporte sin login. */
  const continueAsGuest = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }, []);

  /** Un invitado puede vincular su cuenta de Google conservando la misma sesión/datos. */
  const linkGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: redirectTo ?? currentUrlNoHash() },
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
    signInWithEmailOtp,
    continueAsGuest,
    linkGoogle,
    signOut,
  };
}
