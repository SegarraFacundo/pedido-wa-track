import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Calendar, FileText, Printer, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface Commission {
  id: string;
  vendor_id: string;
  order_id: string;
  commission_amount: number;
  commission_type: string;
  commission_percentage: number;
  order_total: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  vendors: {
    name: string;
    phone: string;
    address: string;
  };
  orders: {
    customer_name: string;
    items: any;
  };
}

export default function CommissionReports() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month");
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [selectedVendor, selectedPeriod]);

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name')
      .order('name');
    setVendors(data || []);
  };

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vendor_commissions')
        .select(`
          *,
          vendors:vendor_id (name, phone, address),
          orders:order_id (customer_name, items)
        `)
        .order('created_at', { ascending: false });

      if (selectedVendor !== "all") {
        query = query.eq('vendor_id', selectedVendor);
      }

      if (selectedPeriod === "today") {
        const today = new Date();
        query = query
          .gte('created_at', startOfDay(today).toISOString())
          .lte('created_at', endOfDay(today).toISOString());
      } else if (selectedPeriod === "month") {
        const today = new Date();
        query = query
          .gte('created_at', startOfMonth(today).toISOString())
          .lte('created_at', endOfMonth(today).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setCommissions(data || []);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCommissions = commissions.reduce((sum, c) => sum + parseFloat(c.commission_amount.toString()), 0);
  const pendingCommissions = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + parseFloat(c.commission_amount.toString()), 0);
  const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + parseFloat(c.commission_amount.toString()), 0);

  const markAsPaid = async (commissionId: string) => {
    const { error } = await supabase
      .from('vendor_commissions')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', commissionId);

    if (!error) {
      fetchCommissions();
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Reportes de Comisiones</h2>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos los negocios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los negocios</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${paidCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de Comisiones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commissions.map((commission) => (
              <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{commission.vendors?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(commission.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pedido: ${commission.order_total.toFixed(2)} | Comisión: {commission.commission_percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tipo: {commission.commission_type === 'percentage' ? 'Porcentaje' : commission.commission_type === 'subscription_overage' ? 'Suscripción (Extra)' : 'Suscripción'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-lg font-bold">${commission.commission_amount.toFixed(2)}</p>
                    <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}>
                      {commission.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCommission(commission);
                      setShowReceipt(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {commission.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => markAsPaid(commission.id)}
                    >
                      Marcar como Pagada
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Comprobante de Comisión</span>
              <Button size="sm" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCommission && (
            <div className="space-y-6 print:p-8" id="receipt">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold">Comprobante de Comisión</h2>
                <p className="text-sm text-muted-foreground">Tu Pedido - Sistema de Gestión</p>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Comprobante #</p>
                  <p className="font-mono">{selectedCommission.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                  <p>{format(new Date(selectedCommission.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Estado</p>
                  <Badge variant={selectedCommission.status === 'paid' ? 'default' : 'secondary'}>
                    {selectedCommission.status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </Badge>
                </div>
                {selectedCommission.paid_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fecha de Pago</p>
                    <p>{format(new Date(selectedCommission.paid_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                  </div>
                )}
              </div>

              {/* Vendor Info */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Información del Negocio</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Nombre:</span> {selectedCommission.vendors?.name}</p>
                  <p><span className="font-medium">Teléfono:</span> {selectedCommission.vendors?.phone}</p>
                  <p><span className="font-medium">Dirección:</span> {selectedCommission.vendors?.address}</p>
                </div>
              </div>

              {/* Commission Details */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Detalle de la Comisión</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total del Pedido:</span>
                    <span>${selectedCommission.order_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tipo de Comisión:</span>
                    <span>
                      {selectedCommission.commission_type === 'percentage' 
                        ? 'Porcentaje por Pedido' 
                        : selectedCommission.commission_type === 'subscription_overage'
                        ? 'Suscripción (Pedido Extra)'
                        : 'Suscripción'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Porcentaje de Comisión:</span>
                    <span>{selectedCommission.commission_percentage}%</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total a Pagar:</span>
                    <span>${selectedCommission.commission_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              {selectedCommission.orders && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Información del Pedido</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">ID del Pedido:</span> {selectedCommission.order_id.slice(0, 8).toUpperCase()}</p>
                    <p><span className="font-medium">Cliente:</span> {selectedCommission.orders.customer_name}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                <p>Este comprobante es válido para efectos de registro de comisión</p>
                <p className="mt-1">Generado el {format(new Date(), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt, #receipt * {
            visibility: visible;
          }
          #receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
