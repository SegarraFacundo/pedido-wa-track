import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PlatformReview {
  id: string;
  user_type: 'vendor' | 'customer';
  reviewer_name: string;
  reviewer_phone: string;
  reviewer_email: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export const PlatformReviewsPanel = () => {
  const [reviews, setReviews] = useState<PlatformReview[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews((data as PlatformReview[]) || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las reseñas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  const calculateStats = (filterType?: 'vendor' | 'customer') => {
    const filtered = filterType 
      ? reviews.filter(r => r.user_type === filterType)
      : reviews;
    
    const avgRating = filtered.length > 0
      ? (filtered.reduce((acc, r) => acc + r.rating, 0) / filtered.length).toFixed(1)
      : '0';
    
    const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: filtered.filter(r => r.rating === rating).length
    }));

    return { avgRating, total: filtered.length, distribution: ratingDistribution };
  };

  const renderReviewsList = (filterType?: 'vendor' | 'customer') => {
    const filtered = filterType 
      ? reviews.filter(r => r.user_type === filterType)
      : reviews;

    if (loading) {
      return <div className="text-center py-8 text-muted-foreground">Cargando reseñas...</div>;
    }

    if (filtered.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No hay reseñas disponibles</div>;
    }

    return (
      <div className="space-y-4">
        {filtered.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{review.reviewer_name}</CardTitle>
                  <CardDescription className="text-sm">
                    {review.reviewer_phone}
                    {review.reviewer_email && ` • ${review.reviewer_email}`}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={review.user_type === 'vendor' ? 'default' : 'secondary'}>
                    {review.user_type === 'vendor' ? '👔 Vendedor' : '👤 Cliente'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderStars(review.rating)}
              {review.comment && (
                <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderStats = (filterType?: 'vendor' | 'customer') => {
    const stats = calculateStats(filterType);
    
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Calificación promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{stats.avgRating}</span>
              {renderStars(Math.round(parseFloat(stats.avgRating)))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Basado en {stats.total} reseña{stats.total !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Distribución de calificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.distribution.map(({ rating, count }) => (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm w-3">{rating}</span>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ 
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">🌟 Reseñas de la Plataforma</h2>
        <p className="text-muted-foreground">
          Opiniones de vendedores y clientes sobre Lapacho
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="vendors">Vendedores</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {renderStats()}
          {renderReviewsList()}
        </TabsContent>

        <TabsContent value="vendors" className="mt-6">
          {renderStats('vendor')}
          {renderReviewsList('vendor')}
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          {renderStats('customer')}
          {renderReviewsList('customer')}
        </TabsContent>
      </Tabs>
    </div>
  );
};
