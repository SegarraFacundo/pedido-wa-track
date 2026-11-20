import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { isVendorOpen } from "@/lib/timezone";

interface VendorRow {
  id: string;
  name: string;
  category: string;
  image: string | null;
  rating: number | null;
  average_rating: number | null;
  opening_time: string | null;
  closing_time: string | null;
  days_open: string[] | null;
}

export default function Home() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("public_vendors")
        .select("id, name, category, image, rating, average_rating, opening_time, closing_time, days_open")
        .order("name");
      if (!error && data) setVendors(data as VendorRow[]);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(vendors.map((v) => v.category).filter(Boolean)))],
    [vendors],
  );

  const filtered = vendors.filter((v) => {
    const byCat = category === "all" || v.category === category;
    const bySearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
    return byCat && bySearch;
  });

  const isOpen = (v: VendorRow) => isVendorOpen(v.days_open, v.opening_time, v.closing_time, false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">¿Qué pedimos hoy?</h1>
        <p className="text-sm text-muted-foreground">Elegí un negocio y armá tu pedido.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar negocio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "Todos" : c}
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No encontramos negocios.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const open = isOpen(v);
            const rating = v.average_rating ?? v.rating ?? 0;
            return (
              <Card
                key={v.id}
                className="cursor-pointer transition hover:shadow-md"
                onClick={() => navigate(localePath(`/tienda/${v.id}`))}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {v.image ? (
                      <img src={v.image} alt={v.name} className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{v.name}</h3>
                      <Badge variant={open ? "default" : "secondary"} className="shrink-0">
                        {open ? "Abierto" : "Cerrado"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm capitalize text-muted-foreground">{v.category}</p>
                  </div>
                  {rating > 0 && (
                    <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {Number(rating).toFixed(1)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
