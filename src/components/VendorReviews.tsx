import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, MessageSquare, User, Truck, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { maskPhone } from '@/lib/utils';

interface VendorReview {
  id: string;
  customer_name?: string;
  customer_phone: string;
  rating?: number | null;
  delivery_rating?: number | null;
  service_rating?: number | null;
  product_rating?: number | null;
  comment?: string;
  created_at: Date;
  order_id?: string | null;
}

interface VendorReviewsProps {
  vendorId: string;
}

export function VendorReviews({ vendorId }: VendorReviewsProps) {
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
    fetchVendorStats();
  }, [vendorId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_reviews')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setReviews(data?.map(review => ({
        ...review,
        created_at: new Date(review.created_at)
      })) || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las reseñas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorStats = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('average_rating, total_reviews')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      setAverageRating(data?.average_rating || 0);
      setTotalReviews(data?.total_reviews || 0);
    } catch (error) {
      console.error('Error fetching vendor stats:', error);
    }
  };

  const renderStars = (rating: number | null | undefined, size: 'sm' | 'md' = 'md') => {
    if (!rating) return null;
    const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      const rating = review.rating || 
        (review.delivery_rating && review.service_rating && review.product_rating 
          ? Math.round((review.delivery_rating + review.service_rating + review.product_rating) / 3)
          : null);
      if (rating) {
        distribution[rating as keyof typeof distribution]++;
      }
    });
    return distribution;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const ratingDistribution = getRatingDistribution();

  return (
    <div className="space-y-6">
      {/* Resumen de calificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Reseñas de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Promedio general */}
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">
                {renderStars(Math.round(averageRating))}
              </div>
              <p className="text-sm text-muted-foreground">
                {totalReviews} reseñas totales
              </p>
            </div>

            {/* Distribución de calificaciones */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm w-3">{rating}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full transition-all"
                      style={{
                        width: `${
                          totalReviews > 0
                            ? (ratingDistribution[rating as keyof typeof ratingDistribution] / totalReviews) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {ratingDistribution[rating as keyof typeof ratingDistribution]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de reseñas */}
      <div className="space-y-4">
        {reviews.map((review) => {
          const hasDetailedRatings = review.delivery_rating || review.service_rating || review.product_rating;
          const displayRating = review.rating || 
            (review.delivery_rating && review.service_rating && review.product_rating 
              ? Math.round((review.delivery_rating + review.service_rating + review.product_rating) / 3)
              : null);

          return (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted rounded-full p-2">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {review.customer_name || maskPhone(review.customer_phone)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(review.created_at, "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                      {review.order_id && (
                        <p className="text-xs text-muted-foreground">
                          Pedido: #{review.order_id.substring(0, 8)}
                        </p>
                      )}
                    </div>
                  </div>
                  {displayRating && renderStars(displayRating)}
                </div>
                
                {/* Calificaciones detalladas */}
                {hasDetailedRatings && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 bg-secondary/10 rounded-lg">
                    {review.delivery_rating && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Tiempo de entrega</p>
                          {renderStars(review.delivery_rating, 'sm')}
                        </div>
                      </div>
                    )}
                    
                    {review.service_rating && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Atención</p>
                          {renderStars(review.service_rating, 'sm')}
                        </div>
                      </div>
                    )}
                    
                    {review.product_rating && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Producto</p>
                          {renderStars(review.product_rating, 'sm')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {review.comment && (
                  <div className="flex gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground flex-1">
                      {review.comment}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {reviews.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Aún no hay reseñas
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Las reseñas de los clientes aparecerán aquí
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}