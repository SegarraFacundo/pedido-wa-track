import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Phone, Star, Store, Pizza, Coffee, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isVendorOpen, getCurrentDayInArgentina, getCurrentTimeInArgentina } from "@/lib/timezone";

interface Product {
  id?: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
}

// Define interface for public vendor view (which doesn't expose sensitive data)
interface PublicVendor {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  rating: number;
  total_orders: number;
  opening_time: string | null;
  closing_time: string | null;
  days_open: string[] | null;
  image: string | null;
  joined_at: string | null;
  address_area: string | null;
  has_products: boolean;
  available_products: any;
  products?: Product[];
}

export function VendorCatalog() {
  const [vendors, setVendors] = useState<PublicVendor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      // Use the secure public_vendors view that doesn't expose sensitive data
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('public_vendors')
        .select('*')
        .order('rating', { ascending: false });

      if (vendorsError) throw vendorsError;

      // Parse available_products JSON for each vendor
      const vendorsWithProducts = vendorsData?.map(vendor => ({
        ...vendor,
        // Map the simplified address from the view
        address: vendor.address_area || 'Ubicación no disponible',
        // Note: phone and whatsapp_number are not available in public view for security
        phone: null,
        whatsapp_number: null,
        products: vendor.available_products ? 
          (Array.isArray(vendor.available_products) ? 
            (vendor.available_products as unknown as Product[]) : 
            []) : []
      })) || [];

      setVendors(vendorsWithProducts);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOpen = (vendor: PublicVendor) => {
    return isVendorOpen(
      vendor.days_open,
      vendor.opening_time,
      vendor.closing_time,
      false
    );
  };

  const filteredVendors = selectedCategory === "all" 
    ? vendors 
    : vendors.filter(v => v.category === selectedCategory);

  // Get unique categories from vendors
  const uniqueCategories = Array.from(new Set(vendors.map(v => v.category)));
  
  const categories = [
    { id: "all", label: "Todos", icon: Store },
    ...uniqueCategories.map(cat => {
      const iconMap: Record<string, any> = {
        'Pizzería': Pizza,
        'Sushi': '🍱',
        'Hamburguesería': '🍔',
        'Empanadas': '🥟',
        'Pastas': '🍝',
        'Cafetería': Coffee,
      };
      return {
        id: cat,
        label: cat,
        icon: iconMap[cat] || Package
      };
    })
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-primary">Cargando locales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            onClick={() => setSelectedCategory(cat.id)}
            className="whitespace-nowrap"
          >
            <span className="mr-2">
              {typeof cat.icon === 'string' ? cat.icon : <cat.icon className="h-4 w-4" />}
            </span>
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Vendors Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{vendor.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="text-sm font-medium">{vendor.rating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({vendor.total_orders} pedidos)
                    </span>
                  </div>
                </div>
                <Badge variant={isOpen(vendor) ? "default" : "secondary"}>
                  {isOpen(vendor) ? "Abierto" : "Cerrado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info básica */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.address_area || 'Ubicación no disponible'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.opening_time?.slice(0,5)} - {vendor.closing_time?.slice(0,5)}</span>
                </div>
              </div>

              {/* Menú con productos */}
              {vendor.products && vendor.products.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Menú</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {vendor.products.slice(0, 5).map((product) => (
                      <div key={product.id} className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground">{product.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          ${product.price}
                        </span>
                      </div>
                    ))}
                    {vendor.products.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{vendor.products.length - 5} productos más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Contact info is now protected - vendors must be contacted through the WhatsApp bot */}
              <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <p>Para realizar pedidos, usa nuestro servicio de WhatsApp</p>
                <p className="font-semibold mt-1">Envía un mensaje al bot de pedidos</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No hay locales disponibles en esta categoría
          </p>
        </Card>
      )}
    </div>
  );
}