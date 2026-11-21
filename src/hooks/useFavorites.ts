import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// customer_favorites todavía no está en los tipos generados de Supabase.
const sb = () => supabase as any;

/** Negocios favoritos del cliente. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    const { data } = await sb().from("customer_favorites").select("vendor_id");
    setFavorites(new Set((data ?? []).map((r: any) => r.vendor_id as string)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isFavorite = useCallback((vendorId: string) => favorites.has(vendorId), [favorites]);

  /** Alterna favorito. Devuelve false si no hay sesión (no se pudo guardar). */
  const toggle = useCallback(
    async (vendorId: string): Promise<boolean> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const wasFav = favorites.has(vendorId);
      // Optimista.
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(vendorId);
        else next.add(vendorId);
        return next;
      });
      try {
        if (wasFav) {
          await sb().from("customer_favorites").delete().eq("user_id", session.user.id).eq("vendor_id", vendorId);
        } else {
          await sb().from("customer_favorites").insert({ user_id: session.user.id, vendor_id: vendorId });
        }
      } catch {
        // Revertir si falla.
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(vendorId);
          else next.delete(vendorId);
          return next;
        });
      }
      return true;
    },
    [favorites],
  );

  return { favorites, isFavorite, toggle, loading, reload: load };
}
