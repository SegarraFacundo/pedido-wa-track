import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  is_available: boolean;
}

interface VendorProductManagerProps {
  vendorId: string;
}

export function VendorProductManager({ vendorId }: VendorProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    is_available: true
  });

  useEffect(() => {
    fetchProducts();
  }, [vendorId]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      setProducts(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(p => p.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.category || !formData.price) {
      toast({
        title: 'Error',
        description: 'Por favor complete todos los campos requeridos',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name,
            category: formData.category,
            description: formData.description || null,
            price: parseFloat(formData.price),
            is_available: formData.is_available
          })
          .eq('id', editingProduct.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Producto actualizado correctamente'
        });
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert({
            vendor_id: vendorId,
            name: formData.name,
            category: formData.category,
            description: formData.description || null,
            price: parseFloat(formData.price),
            is_available: formData.is_available
          });

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Producto agregado correctamente'
        });
      }

      // Reset form and refresh
      setFormData({
        name: '',
        category: '',
        description: '',
        price: '',
        is_available: true
      });
      setIsAddingProduct(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el producto',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Producto eliminado correctamente'
      });
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el producto',
        variant: 'destructive'
      });
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id);

      if (error) throw error;

      fetchProducts();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la disponibilidad',
        variant: 'destructive'
      });
    }
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      description: product.description || '',
      price: product.price.toString(),
      is_available: product.is_available
    });
    setIsAddingProduct(true);
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gestión de Productos</h2>
        <Button onClick={() => setIsAddingProduct(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Producto
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="all">Todos ({products.length})</TabsTrigger>
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category} ({products.filter(p => p.category === category).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          <div className="grid gap-3">
            {filteredProducts.map(product => (
              <Card key={product.id} className={!product.is_available ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{product.name}</h3>
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full">
                          {product.category}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
                      )}
                      <p className="text-lg font-bold text-primary">
                        ${product.price.toLocaleString('es-AR')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_available}
                        onCheckedChange={() => handleToggleAvailability(product)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditProduct(product)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredProducts.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No hay productos en esta categoría
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Product Dialog */}
      <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Pizza Mozzarella"
              />
            </div>
            
            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ej: Pizzas, Bebidas, etc."
                list="categories"
              />
              <datalist id="categories">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional del producto"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="price">Precio *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
              <Label htmlFor="available">Disponible</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingProduct(false);
                setEditingProduct(null);
                setFormData({
                  name: '',
                  category: '',
                  description: '',
                  price: '',
                  is_available: true
                });
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}