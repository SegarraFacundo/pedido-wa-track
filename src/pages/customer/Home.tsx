import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Search, Star, Store, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLocalePath } from "@/hooks/useLocalePath";
import { useFavorites } from "@/hooks/useFavorites";
import { isVendorOpen } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface VendorRow {
  id: string;
  slug: string | null;
  name: string;
  category: string;
  image: string | null;
  rating: number | null;
  average_rating: number | null;
  is_featured: boolean | null;
  opening_time: string | null;
  closing_time: string | null;
  days_open: string[] | null;
}

interface OfferRow {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  vendor_id: string;
  valid_until: string | null;
}

export default function Home() {
  const navigate = useNavigate();
  const localePath = useLocalePath();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const { isFavorite, toggle: toggleFavorite, favorites } = useFavorites();

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [{ data: v }, { data: o }] = await Promise.all([
        supabase
          .from("public_vendors")
          .select(
            "id, slug, name, category, image, rating, average_rating, is_featured, opening_time, closing_time, days_open",
          )
          .order("name"),
        supabase
          .from("vendor_offers")
          .select("id, title, description, discount_percentage, vendor_id, valid_until")
          .eq("is_active", true),
      ]);
      if (v) setVendors(v as VendorRow[]);
      if (o) setOffers(((o as OfferRow[]) ?? []).filter((x) => !x.valid_until || x.valid_until >= nowIso));
      setLoading(false);
    })();
  }, []);

  const isOpen = (v: VendorRow) => isVendorOpen(v.days_open, v.opening_time, v.closing_time, false);
  // Abiertos primero; dentro de cada grupo se mantiene el orden por nombre.
  const byOpen = (a: VendorRow, b: VendorRow) => Number(isOpen(b)) - Number(isOpen(a));

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(vendors.map((v) => v.category).filter(Boolean)))],
    [vendors],
  );

  const q = search.trim().toLowerCase();
  const isFiltering = q.length > 0 || category !== "all";

  const matches = (v: VendorRow) =>
    (category === "all" || v.category === category) && (!q || v.name.toLowerCase().includes(q));

  const filtered = useMemo(() => vendors.filter(matches).sort(byOpen), [vendors, q, category]);
  const featured = useMemo(() => vendors.filter((v) => v.is_featured).sort(byOpen), [vendors]);
  const regular = useMemo(() => vendors.filter((v) => !v.is_featured).sort(byOpen), [vendors]);
  const favoriteVendors = useMemo(
    () => vendors.filter((v) => isFavorite(v.id)).sort(byOpen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendors, favorites],
  );

  // Promos: sólo de negocios activos (presentes en public_vendors).
  const promos = useMemo(() => {
    const byId = new Map(vendors.map((v) => [v.id, v]));
    return offers
      .map((o) => ({ offer: o, vendor: byId.get(o.vendor_id) }))
      .filter((x): x is { offer: OfferRow; vendor: VendorRow } => !!x.vendor);
  }, [offers, vendors]);

  const goToVendor = (v: VendorRow) => navigate(localePath(`/tienda/${v.slug ?? v.id}`));

  const renderVendor = (v: VendorRow) => {
    const open = isOpen(v);
    const rating = v.average_rating ?? v.rating ?? 0;
    return (
      <Card key={v.id} className="cursor-pointer transition hover:shadow-md" onClick={() => goToVendor(v)}>
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(v.id);
            }}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
            aria-label={isFavorite(v.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
          >
            <Heart className={cn("h-5 w-5", isFavorite(v.id) && "fill-primary text-primary")} />
          </button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
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
      ) : isFiltering ? (
        // Con búsqueda o categoría elegida: lista plana (abiertos primero).
        filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No encontramos negocios.</p>
        ) : (
          <div className="space-y-3">{filtered.map(renderVendor)}</div>
        )
      ) : (
        <div className="space-y-6">
          {/* Favoritos del cliente */}
          {favoriteVendors.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Heart className="h-4 w-4 fill-primary text-primary" /> Favoritos
              </h2>
              {favoriteVendors.map(renderVendor)}
            </section>
          )}

          {/* Destacados (negocios que pagan por aparecer arriba) */}
          {featured.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Destacados
              </h2>
              {featured.map(renderVendor)}
            </section>
          )}

          {/* Promociones y descuentos activos */}
          {promos.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Tag className="h-4 w-4 text-primary" /> Promociones
              </h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {promos.map(({ offer, vendor }) => (
                  <button
                    key={offer.id}
                    onClick={() => goToVendor(vendor)}
                    className="min-w-[220px] max-w-[240px] shrink-0 rounded-lg border bg-card p-3 text-left transition hover:shadow-md"
                  >
                    <div className="mb-1.5">
                      {offer.discount_percentage ? (
                        <Badge>{offer.discount_percentage}% OFF</Badge>
                      ) : (
                        <Badge variant="secondary">Promo</Badge>
                      )}
                    </div>
                    <p className="line-clamp-1 font-semibold">{offer.title}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{vendor.name}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Todos los negocios (abiertos primero) */}
          <section className="space-y-3">
            {(featured.length > 0 || promos.length > 0) && (
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Todos los negocios
              </h2>
            )}
            {regular.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No hay negocios por ahora.</p>
            ) : (
              <div className="space-y-3">{regular.map(renderVendor)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
