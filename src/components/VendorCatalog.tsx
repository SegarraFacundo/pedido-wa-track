import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Phone, Star, Store, Pizza, Utensils, Coffee, ShoppingBag, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Database } from "@/integrations/supabase/types";

type VendorRow = Database['public']['Tables']['vendors']['Row'];

interface Product {
  id?: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
}

interface VendorWithProducts extends VendorRow {
  products?: Product[];
}

export function VendorCatalog() {
  const [vendors, setVendors] = useState<VendorWithProducts[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('rating', { ascending: false });

      if (vendorsError) throw vendorsError;

      // Parse available_products JSON for each vendor
      const vendorsWithProducts = vendorsData?.map(vendor => ({
        ...vendor,
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

  const isOpen = (vendor: VendorWithProducts) => {
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (!vendor.days_open?.includes(currentDay)) {
      return false;
    }
    
    return currentTime >= vendor.opening_time && currentTime <= vendor.closing_time;
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
                  <span>{vendor.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.opening_time?.slice(0,5)} - {vendor.closing_time?.slice(0,5)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.whatsapp_number || vendor.phone}</span>
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

              {/* Botón de WhatsApp */}
              {vendor.whatsapp_number && (
                <Button 
                  className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white"
                  onClick={() => {
                    const phoneNumber = vendor.whatsapp_number?.replace(/\D/g, '');
                    window.open(`https://wa.me/${phoneNumber}`, '_blank');
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Pedir por WhatsApp
                </Button>
              )}
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