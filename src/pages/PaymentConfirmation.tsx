import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface OrderDetails {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  payment_status: string;
  items: any[];
}

const PaymentConfirmation = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const orderId = searchParams.get("orderId") || searchParams.get("external_reference");
  const status = searchParams.get("status") || searchParams.get("collection_status");
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id");

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        toast.error(t('payment.noOrderId'));
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (error) throw error;
        setOrder(data as OrderDetails);
      } catch (error) {
        console.error("Error fetching order:", error);
        toast.error(t('payment.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, t]);

  const getStatusConfig = () => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "approved" || statusLower === "success") {
      return { icon: <CheckCircle className="w-16 h-16 text-green-500" />, title: t('payment.successTitle'), description: t('payment.successDesc'), message: t('payment.successMessage'), color: "text-green-600", bgColor: "bg-green-50" };
    } else if (statusLower === "pending" || statusLower === "in_process") {
      return { icon: <Clock className="w-16 h-16 text-yellow-500" />, title: t('payment.pendingTitle'), description: t('payment.pendingDesc'), message: t('payment.pendingMessage'), color: "text-yellow-600", bgColor: "bg-yellow-50" };
    } else {
      return { icon: <XCircle className="w-16 h-16 text-red-500" />, title: t('payment.failedTitle'), description: t('payment.failedDesc'), message: t('payment.failedMessage'), color: "text-red-600", bgColor: "bg-red-50" };
    }
  };

  const statusConfig = getStatusConfig();
  const handleWhatsAppRedirect = () => { window.location.href = `https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || ""}`; };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('payment.loadingPayment')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">{statusConfig.icon}</div>
            <CardTitle className={`text-2xl ${statusConfig.color}`}>{statusConfig.title}</CardTitle>
            <CardDescription className="text-base">{statusConfig.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={`p-4 rounded-lg ${statusConfig.bgColor}`}>
              <p className={`text-center ${statusConfig.color}`}>{statusConfig.message}</p>
            </div>
            {paymentId && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground"><strong>{t('payment.paymentId')}:</strong> {paymentId}</p>
              </div>
            )}
            {order && (
              <div className="border-t pt-4 space-y-2">
                <h3 className="font-semibold text-lg">{t('payment.orderDetails')}</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>{t('payment.order')}:</strong> #{order.id.slice(0, 8)}</p>
                  <p><strong>{t('payment.customer')}:</strong> {order.customer_name}</p>
                  <p><strong>{t('payment.total')}:</strong> ${order.total}</p>
                  <p><strong>{t('payment.orderStatus')}:</strong> {order.status}</p>
                  <p><strong>{t('payment.paymentStatus')}:</strong> {order.payment_status || t('payment.pending')}</p>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="mt-4">
                    <p className="font-medium mb-2">{t('payment.products')}:</p>
                    <ul className="space-y-1 text-sm">
                      {order.items.map((item: any, index: number) => (
                        <li key={index}>{item.quantity}x {item.product_name || item.name} - ${item.price}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={handleWhatsAppRedirect} className="flex-1" variant="default">
                <MessageCircle className="w-4 h-4 mr-2" />{t('payment.backToWhatsApp')}
              </Button>
              <Button onClick={() => navigate("/")} variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />{t('payment.goHome')}
              </Button>
            </div>
            {status?.toLowerCase() === "failure" && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground mb-2">{t('payment.needHelp')}</p>
                <Button onClick={handleWhatsAppRedirect} variant="link" className="text-primary">{t('payment.contactVendor')}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentConfirmation;