import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Package, Image } from 'lucide-react';

const FARMACIA_VENDOR_ID = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

const PHARMACY_PRODUCTS = [
  // Analgésicos y Antifebriles
  { name: 'Aspirina 500mg', description: 'Analgésico y antiinflamatorio, caja x20 comprimidos', price: 8500, category: ['Analgésicos'] },
  { name: 'Bayaspirina', description: 'Aspirina efervescente, tubo x10 comprimidos', price: 12000, category: ['Analgésicos'] },
  { name: 'Novalgina 500mg', description: 'Dipirona analgésica y antifebril, caja x10 comprimidos', price: 15000, category: ['Analgésicos'] },
  
  // Antigripales y Resfríos
  { name: 'Tafirol Grip', description: 'Antigripal con paracetamol y descongestionante, caja x10', price: 18000, category: ['Antigripales'] },
  { name: 'Qura Plus', description: 'Antigripal día y noche, caja x12 comprimidos', price: 22000, category: ['Antigripales'] },
  { name: 'Nastizol Compuesto', description: 'Para síntomas de gripe y resfrío, jarabe 120ml', price: 16000, category: ['Antigripales'] },
  
  // Primeros Auxilios
  { name: 'Curitas surtidas x20', description: 'Curitas adhesivas de varios tamaños, caja x20 unidades', price: 6500, category: ['Primeros Auxilios'] },
  { name: 'Gasa estéril 10x10', description: 'Gasa estéril para heridas, paquete x10 unidades', price: 4000, category: ['Primeros Auxilios'] },
  { name: 'Agua Oxigenada 250ml', description: 'Solución antiséptica para limpieza de heridas', price: 5500, category: ['Primeros Auxilios'] },
  { name: 'Pervinox', description: 'Antiséptico de amplio espectro, frasco 60ml', price: 9000, category: ['Primeros Auxilios'] },
  
  // Cuidado Personal
  { name: 'Protector Solar FPS 50', description: 'Protección solar alta, resistente al agua, 200ml', price: 28000, category: ['Cuidado Personal'] },
  { name: 'Repelente OFF! Family', description: 'Repelente de insectos para toda la familia, aerosol 170ml', price: 15000, category: ['Cuidado Personal'] },
  { name: 'Crema Dermaglos', description: 'Crema hidratante hipoalergénica, pote 100g', price: 18000, category: ['Cuidado Personal'] },
  
  // Vitaminas y Suplementos
  { name: 'Vitamina D 1000UI', description: 'Suplemento de vitamina D3, frasco x60 cápsulas', price: 22000, category: ['Vitaminas'] },
  { name: 'Complejo B', description: 'Complejo vitamínico B1, B6, B12, caja x30 comprimidos', price: 19000, category: ['Vitaminas'] },
  { name: 'Omega 3', description: 'Aceite de pescado con EPA y DHA, frasco x60 cápsulas', price: 35000, category: ['Vitaminas'] },
  { name: 'Magnesio 400mg', description: 'Suplemento de magnesio para músculos, frasco x60 comprimidos', price: 24000, category: ['Vitaminas'] },
  
  // Digestivos
  { name: 'Sertal Compuesto', description: 'Antiespasmódico para dolores abdominales, caja x20', price: 14000, category: ['Digestivos'] },
  { name: 'Alka Seltzer', description: 'Efervescente para acidez y malestar estomacal, tubo x10', price: 9500, category: ['Digestivos'] },
  { name: 'Hepatalgina', description: 'Para malestares hepáticos y digestivos, caja x20', price: 16000, category: ['Digestivos'] },
  { name: 'Imodium', description: 'Antidiarreico de acción rápida, caja x12 comprimidos', price: 18000, category: ['Digestivos'] },
  
  // Cuidado Ocular
  { name: 'Systane Ultra', description: 'Gotas lubricantes para ojos secos, frasco 10ml', price: 32000, category: ['Cuidado Ocular'] },
  { name: 'Lágrimas artificiales', description: 'Lubricante ocular suave, frasco 15ml', price: 12000, category: ['Cuidado Ocular'] },
  
  // Higiene Bucal
  { name: 'Enjuague Listerine 500ml', description: 'Enjuague bucal antiséptico, menta fresca', price: 14000, category: ['Higiene Bucal'] },
  { name: 'Hilo dental Oral-B', description: 'Hilo dental encerado, 50 metros', price: 8000, category: ['Higiene Bucal'] },
];

interface ProductResult {
  name: string;
  success: boolean;
  error?: string;
}

export default function PharmacyProductLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [currentProduct, setCurrentProduct] = useState<string>('');

  const loadProducts = async () => {
    setIsLoading(true);
    setProgress(0);
    setResults([]);
    
    try {
      toast.info('Iniciando carga de productos con imágenes generadas por IA...');
      
      // Process in batches of 5 to avoid timeouts
      const batchSize = 5;
      const allResults: ProductResult[] = [];
      
      for (let i = 0; i < PHARMACY_PRODUCTS.length; i += batchSize) {
        const batch = PHARMACY_PRODUCTS.slice(i, i + batchSize);
        setCurrentProduct(`Procesando lote ${Math.floor(i/batchSize) + 1} de ${Math.ceil(PHARMACY_PRODUCTS.length/batchSize)}...`);
        
        const response = await supabase.functions.invoke('generate-product-images', {
          body: {
            products: batch,
            vendor_id: FARMACIA_VENDOR_ID,
          },
        });

        if (response.error) {
          console.error('Error en lote:', response.error);
          batch.forEach(p => allResults.push({ name: p.name, success: false, error: response.error.message }));
        } else if (response.data?.results) {
          allResults.push(...response.data.results);
        }
        
        setResults([...allResults]);
        setProgress(((i + batch.length) / PHARMACY_PRODUCTS.length) * 100);
      }
      
      const successCount = allResults.filter(r => r.success).length;
      toast.success(`Carga completada: ${successCount}/${PHARMACY_PRODUCTS.length} productos creados`);
      
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoading(false);
      setCurrentProduct('');
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Cargar Productos de Farmacia
        </CardTitle>
        <CardDescription>
          Genera imágenes con IA y carga {PHARMACY_PRODUCTS.length} productos de venta libre para Farmacia San José
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {['Analgésicos', 'Antigripales', 'Primeros Auxilios', 'Cuidado Personal', 'Vitaminas', 'Digestivos', 'Cuidado Ocular', 'Higiene Bucal'].map(cat => (
            <Badge key={cat} variant="outline">{cat}</Badge>
          ))}
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <Image className="inline h-4 w-4 mr-1" />
            Este proceso generará imágenes profesionales usando OpenAI gpt-image-1 para cada producto.
          </p>
          <p className="text-xs text-muted-foreground">
            Tiempo estimado: ~5-10 minutos (depende del API de OpenAI)
          </p>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{currentProduct}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" /> {successCount} exitosos
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" /> {failedCount} fallidos
                </span>
              )}
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 ${r.success ? 'text-green-600' : 'text-red-600'}`}>
                  {r.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  <span>{r.name}</span>
                  {r.error && <span className="text-muted-foreground">- {r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button 
          onClick={loadProducts} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando imágenes y cargando productos...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Cargar {PHARMACY_PRODUCTS.length} Productos con Imágenes IA
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
