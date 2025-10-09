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
import { Plus, Edit2, Trash2, Save, X, Upload } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  is_available: boolean;
  image: string | null;
  stock_enabled: boolean;
  stock_quantity: number | null;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    is_available: true,
    image: null as string | null,
    stock_enabled: false,
    stock_quantity: ''
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return formData.image;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${vendorId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen',
        variant: 'destructive'
      });
      return formData.image;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image: null });
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
      // Upload image if selected
      const imageUrl = await handleImageUpload();

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name,
            category: formData.category,
            description: formData.description || null,
            price: parseFloat(formData.price),
            is_available: formData.is_available,
            image: imageUrl,
            stock_enabled: formData.stock_enabled,
            stock_quantity: formData.stock_enabled ? (formData.stock_quantity ? parseInt(formData.stock_quantity) : 0) : null
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
            is_available: formData.is_available,
            image: imageUrl,
            stock_enabled: formData.stock_enabled,
            stock_quantity: formData.stock_enabled ? (formData.stock_quantity ? parseInt(formData.stock_quantity) : 0) : null
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
        is_available: true,
        image: null,
        stock_enabled: false,
        stock_quantity: ''
      });
      setImageFile(null);
      setImagePreview(null);
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
      is_available: product.is_available,
      image: product.image,
      stock_enabled: product.stock_enabled,
      stock_quantity: product.stock_quantity?.toString() || ''
    });
    setImagePreview(product.image);
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
                  <div className="flex items-start justify-between gap-4">
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
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
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-primary">
                          ${product.price.toLocaleString('es-AR')}
                        </p>
                        {product.stock_enabled && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            (product.stock_quantity || 0) === 0 
                              ? 'bg-red-100 text-red-700' 
                              : (product.stock_quantity || 0) < 5
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            Stock: {product.stock_quantity || 0}
                          </span>
                        )}
                      </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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

            <div>
              <Label htmlFor="product-image">Imagen del Producto (opcional)</Label>
              {(imagePreview || formData.image) && (
                <div className="relative w-32 h-32 mb-2">
                  <img 
                    src={imagePreview || formData.image!} 
                    alt="Preview" 
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceptados: JPG, PNG, WEBP (máx 5MB)
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
              <Label htmlFor="available">Disponible</Label>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="stock-enabled"
                  checked={formData.stock_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, stock_enabled: checked })}
                />
                <Label htmlFor="stock-enabled">Controlar Stock</Label>
              </div>
              
              {formData.stock_enabled && (
                <div>
                  <Label htmlFor="stock-quantity">Cantidad en Stock</Label>
                  <Input
                    id="stock-quantity"
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    El producto se deshabilitará automáticamente cuando el stock llegue a 0
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingProduct(false);
                setEditingProduct(null);
                setImageFile(null);
                setImagePreview(null);
                setFormData({
                  name: '',
                  category: '',
                  description: '',
                  price: '',
                  is_available: true,
                  image: null,
                  stock_enabled: false,
                  stock_quantity: ''
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