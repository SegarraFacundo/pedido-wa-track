import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, CheckCircle, XCircle, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VendorCommissionSummary {
  vendor_id: string;
  vendor_name: string;
  vendor_phone: string;
  pending_commissions: number;
  commission_count: number;
  commission_details: Array<{
    id: string;
    order_id: string;
    commission_amount: number;
    order_total: number;
    created_at: string;
  }>;
}

interface Invoice {
  id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: string;
  generated_at: string;
}

export default function CommissionInvoiceGenerator() {
  const [loading, setLoading] = useState(false);
  const [vendorSummaries, setVendorSummaries] = useState<VendorCommissionSummary[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [generatingPeriod, setGeneratingPeriod] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPendingCommissions(), fetchRecentInvoices()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCommissions = async () => {
    const { data: commissions, error } = await supabase
      .from('vendor_commissions')
      .select(`
        id,
        vendor_id,
        commission_amount,
        order_total,
        order_id,
        created_at,
        vendors (name, phone)
      `)
      .eq('status', 'pending')
      .order('vendor_id');

    if (error) throw error;

    // Group by vendor
    const grouped = commissions?.reduce((acc: any, comm: any) => {
      const vendorId = comm.vendor_id;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendor_id: vendorId,
          vendor_name: comm.vendors?.name || 'Desconocido',
          vendor_phone: comm.vendors?.phone || '',
          pending_commissions: 0,
          commission_count: 0,
          commission_details: []
        };
      }
      acc[vendorId].pending_commissions += parseFloat(comm.commission_amount || '0');
      acc[vendorId].commission_count += 1;
      acc[vendorId].commission_details.push({
        id: comm.id,
        order_id: comm.order_id,
        commission_amount: parseFloat(comm.commission_amount || '0'),
        order_total: parseFloat(comm.order_total || '0'),
        created_at: comm.created_at
      });
      return acc;
    }, {});

    setVendorSummaries(Object.values(grouped || {}));
  };

  const fetchRecentInvoices = async () => {
    const { data, error } = await supabase
      .from('commission_invoices')
      .select(`
        id,
        vendor_id,
        invoice_number,
        period_start,
        period_end,
        total_amount,
        status,
        generated_at,
        vendors (name)
      `)
      .order('generated_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const formatted = data?.map((inv: any) => ({
      ...inv,
      vendor_name: inv.vendors?.name || 'Desconocido'
    })) || [];

    setRecentInvoices(formatted);
  };

  const closeBiweeklyPeriod = async () => {
    try {
      setGeneratingPeriod(true);

      // Calculate period dates (last 15 days)
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 15);

      // For each vendor with pending commissions
      for (const vendor of vendorSummaries) {
        // Generate invoice number
        const { data: invoiceNumber, error: invoiceNumError } = await supabase
          .rpc('generate_invoice_number');

        if (invoiceNumError) throw invoiceNumError;

        // Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('commission_invoices')
          .insert({
            vendor_id: vendor.vendor_id,
            invoice_number: invoiceNumber,
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
            total_amount: vendor.pending_commissions,
            status: 'pending'
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Link commission items to invoice
        const invoiceItems = vendor.commission_details.map(detail => ({
          invoice_id: invoice.id,
          commission_id: detail.id
        }));

        const { error: itemsError } = await supabase
          .from('commission_invoice_items')
          .insert(invoiceItems);

        if (itemsError) throw itemsError;

        // Update commission status to 'invoiced'
        const commissionIds = vendor.commission_details.map(d => d.id);
        const { error: updateError } = await supabase
          .from('vendor_commissions')
          .update({ status: 'invoiced' })
          .in('id', commissionIds);

        if (updateError) throw updateError;
      }

      toast.success(`Se generaron ${vendorSummaries.length} facturas exitosamente`);
      await fetchData();
    } catch (error) {
      console.error('Error closing period:', error);
      toast.error('Error al cerrar período quincenal');
    } finally {
      setGeneratingPeriod(false);
    }
  };

  const markInvoiceAsPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('commission_invoices')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

      // Update related commissions to 'paid'
      const { data: items } = await supabase
        .from('commission_invoice_items')
        .select('commission_id')
        .eq('invoice_id', invoiceId);

      if (items) {
        const commissionIds = items.map(item => item.commission_id);
        await supabase
          .from('vendor_commissions')
          .update({ status: 'paid' })
          .in('id', commissionIds);
      }

      toast.success('Factura marcada como pagada');
      await fetchData();
      setSelectedInvoice(null);
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Error al marcar factura como pagada');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "outline", label: "Pendiente" },
      paid: { variant: "default", label: "Pagado" },
      cancelled: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Closing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cerrar Período Quincenal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Este proceso generará facturas automáticamente para todos los vendors con comisiones pendientes,
              correspondientes a los últimos 15 días.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Vendors con comisiones pendientes: {vendorSummaries.length}</p>
              <p className="text-sm text-muted-foreground">
                Total a facturar: {formatCurrency(vendorSummaries.reduce((sum, v) => sum + v.pending_commissions, 0))}
              </p>
            </div>
            <Button
              onClick={closeBiweeklyPeriod}
              disabled={vendorSummaries.length === 0 || generatingPeriod}
            >
              {generatingPeriod ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generar Facturas
                </>
              )}
            </Button>
          </div>

          {vendorSummaries.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">Vista previa:</p>
              {vendorSummaries.slice(0, 5).map((vendor) => (
                <div key={vendor.vendor_id} className="flex justify-between text-sm">
                  <span>{vendor.vendor_name}</span>
                  <span className="font-medium">{formatCurrency(vendor.pending_commissions)}</span>
                </div>
              ))}
              {vendorSummaries.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{vendorSummaries.length - 5} vendors más
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas Generadas</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay facturas generadas aún
            </p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{invoice.vendor_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.invoice_number} • {new Date(invoice.period_start).toLocaleDateString('es-PY')} - {new Date(invoice.period_end).toLocaleDateString('es-PY')}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(invoice.total_amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(invoice.generated_at).toLocaleDateString('es-PY')}
                      </div>
                    </div>
                    {getStatusBadge(invoice.status)}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      {invoice.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => markInvoiceAsPaid(invoice.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Factura</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Factura</p>
                  <p className="font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{selectedInvoice.vendor_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {new Date(selectedInvoice.period_start).toLocaleDateString('es-PY')} - {new Date(selectedInvoice.period_end).toLocaleDateString('es-PY')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedInvoice.total_amount)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
                {selectedInvoice.status === 'pending' && (
                  <Button
                    className="flex-1"
                    onClick={() => markInvoiceAsPaid(selectedInvoice.id)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como Pagado
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
