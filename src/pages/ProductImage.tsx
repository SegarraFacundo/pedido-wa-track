import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ProductImage = () => {
  const { productId } = useParams<{ productId: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      if (!productId) {
        setError(true);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('image, name')
        .eq('id', productId)
        .single();

      if (fetchError || !data?.image) {
        setError(true);
        return;
      }

      // Redirect to the actual image URL
      window.location.href = data.image;
    };

    fetchAndRedirect();
  }, [productId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <p className="text-muted-foreground">Imagen no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Cargando imagen...</p>
      </div>
    </div>
  );
};

export default ProductImage;
