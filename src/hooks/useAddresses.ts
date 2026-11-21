import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SavedAddress {
  id: string;
  label: string | null;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  is_default: boolean;
  created_at: string;
}

// customer_addresses todavía no está en los tipos generados de Supabase.
// (correr `supabase gen types` tras aplicar la migración para tiparlo).
const sb = () => supabase as any;

/** Direcciones guardadas del cliente (Casa, Trabajo, etc.). */
export function useAddresses() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    const { data } = await sb()
      .from("customer_addresses")
      .select("id, label, address, coordinates, is_default, created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setAddresses((data as SavedAddress[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAddress = useCallback(
    async (input: {
      address: string;
      label?: string | null;
      coordinates?: { lat: number; lng: number } | null;
      makeDefault?: boolean;
    }): Promise<SavedAddress | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const userId = session.user.id;

      // La primera dirección queda como principal automáticamente.
      const { count } = await sb()
        .from("customer_addresses")
        .select("id", { count: "exact", head: true });
      const isDefault = (input.makeDefault ?? false) || (count ?? 0) === 0;

      if (isDefault) {
        await sb().from("customer_addresses").update({ is_default: false }).eq("user_id", userId);
      }
      const { data } = await sb()
        .from("customer_addresses")
        .insert({
          user_id: userId,
          address: input.address.trim(),
          label: input.label?.trim() || null,
          coordinates: input.coordinates ?? null,
          is_default: isDefault,
        })
        .select()
        .single();
      await load();
      return (data as SavedAddress) ?? null;
    },
    [load],
  );

  const setDefault = useCallback(
    async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await sb().from("customer_addresses").update({ is_default: false }).eq("user_id", session.user.id);
      await sb().from("customer_addresses").update({ is_default: true }).eq("id", id);
      await load();
    },
    [load],
  );

  const removeAddress = useCallback(
    async (id: string) => {
      await sb().from("customer_addresses").delete().eq("id", id);
      await load();
    },
    [load],
  );

  return { addresses, loading, reload: load, addAddress, setDefault, removeAddress };
}
