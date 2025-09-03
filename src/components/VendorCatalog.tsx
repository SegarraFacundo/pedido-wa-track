import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, Phone, Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Product {
  name: string;
  price: number;
  description?: string;
}

interface ProductCategory {
  category: string;
  items: Product[];
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  is_active: boolean;
  rating: number;
  total_orders: number;
  opening_time: string;
  closing_time: string;
  days_open: string[];
  available_products: any;
}

export function VendorCatalog() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (data && !error) {
      setVendors(data);
    }
    setLoading(false);
  };

  const isOpen = (vendor: Vendor) => {
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

  const categories = [
    { id: "all", label: "Todos", icon: Store },
    { id: "restaurant", label: "Restaurantes", icon: "🍽️" },
    { id: "pharmacy", label: "Farmacias", icon: "💊" },
    { id: "market", label: "Mercados", icon: "🛒" },
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

              {/* Menú con Tabs */}
              {vendor.available_products && vendor.available_products.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Menú</h4>
                  <Tabs defaultValue="0" className="w-full">
                    <TabsList className="grid w-full" style={{ 
                      gridTemplateColumns: `repeat(${Math.min(vendor.available_products.length, 3)}, 1fr)` 
                    }}>
                      {vendor.available_products.slice(0, 3).map((cat, idx) => (
                        <TabsTrigger key={idx} value={idx.toString()} className="text-xs">
                          {cat.category.split(' ')[0]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {vendor.available_products.slice(0, 3).map((cat, idx) => (
                      <TabsContent key={idx} value={idx.toString()} className="mt-3 space-y-2">
                        {cat.items.slice(0, 4).map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-primary">
                              ${item.price}
                            </span>
                          </div>
                        ))}
                        {cat.items.length > 4 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{cat.items.length - 4} productos más
                          </p>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}

              {/* Botón de WhatsApp */}
              <Button 
                className="w-full bg-whatsapp hover:bg-whatsapp-dark"
                onClick={() => window.open(`https://wa.me/${vendor.whatsapp_number}`, '_blank')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Pedir por WhatsApp
              </Button>
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