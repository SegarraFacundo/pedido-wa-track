import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Save } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
}

interface CommissionSetting {
  id: string;
  vendor_id: string;
  commission_type: string;
  commission_percentage: number;
  subscription_orders_included: number;
  subscription_monthly_fee: number;
  is_active: boolean;
}

export default function CommissionManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [commissions, setCommissions] = useState<CommissionSetting[]>([]);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    vendor_id: "",
    commission_type: "percentage",
    commission_percentage: 10,
    subscription_orders_included: 0,
    subscription_monthly_fee: 0,
  });

  useEffect(() => {
    fetchVendors();
    fetchCommissions();
  }, []);

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('payment_status', 'active')
      .order('name');
    setVendors(data || []);
  };

  const fetchCommissions = async () => {
    const { data } = await supabase
      .from('commission_settings')
      .select('*');
    setCommissions(data || []);
  };

  const saveCommission = async () => {
    try {
      const existing = commissions.find(c => c.vendor_id === formData.vendor_id);

      if (existing) {
        const { error } = await supabase
          .from('commission_settings')
          .update({
            commission_type: formData.commission_type,
            commission_percentage: formData.commission_percentage,
            subscription_orders_included: formData.subscription_orders_included,
            subscription_monthly_fee: formData.subscription_monthly_fee,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('commission_settings')
          .insert({
            vendor_id: formData.vendor_id,
            commission_type: formData.commission_type,
            commission_percentage: formData.commission_percentage,
            subscription_orders_included: formData.subscription_orders_included,
            subscription_monthly_fee: formData.subscription_monthly_fee,
          });

        if (error) throw error;
      }

      toast({
        title: "Comisión guardada",
        description: "La configuración de comisión ha sido actualizada",
      });

      setEditingVendor(null);
      fetchCommissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadCommissionForVendor = (vendorId: string) => {
    const commission = commissions.find(c => c.vendor_id === vendorId);
    if (commission) {
      setFormData({
        vendor_id: vendorId,
        commission_type: commission.commission_type,
        commission_percentage: commission.commission_percentage,
        subscription_orders_included: commission.subscription_orders_included,
        subscription_monthly_fee: commission.subscription_monthly_fee,
      });
    } else {
      setFormData({
        vendor_id: vendorId,
        commission_type: "percentage",
        commission_percentage: 10,
        subscription_orders_included: 0,
        subscription_monthly_fee: 0,
      });
    }
    setEditingVendor(vendorId);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Gestión de Comisiones</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {vendors.map((vendor) => {
          const commission = commissions.find(c => c.vendor_id === vendor.id);
          const isEditing = editingVendor === vendor.id;

          return (
            <Card key={vendor.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{vendor.name}</CardTitle>
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadCommissionForVendor(vendor.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Comisión</label>
                      <Select
                        value={formData.commission_type}
                        onValueChange={(value) => setFormData({ ...formData, commission_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentaje por Pedido</SelectItem>
                          <SelectItem value="subscription">Suscripción Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Porcentaje (%)</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.commission_percentage}
                        onChange={(e) => setFormData({ ...formData, commission_percentage: parseFloat(e.target.value) })}
                      />
                    </div>

                    {formData.commission_type === 'subscription' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Pedidos Incluidos</label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.subscription_orders_included}
                            onChange={(e) => setFormData({ ...formData, subscription_orders_included: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Cuota Mensual ($)</label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.subscription_monthly_fee}
                            onChange={(e) => setFormData({ ...formData, subscription_monthly_fee: parseFloat(e.target.value) })}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={saveCommission} className="flex-1">
                        <Save className="mr-2 h-4 w-4" />
                        Guardar
                      </Button>
                      <Button variant="outline" onClick={() => setEditingVendor(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {commission ? (
                      <>
                        <p className="text-sm">
                          <span className="font-medium">Tipo:</span>{" "}
                          {commission.commission_type === 'percentage' ? 'Porcentaje' : 'Suscripción'}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Comisión:</span> {commission.commission_percentage}%
                        </p>
                        {commission.commission_type === 'subscription' && (
                          <>
                            <p className="text-sm">
                              <span className="font-medium">Pedidos incluidos:</span>{" "}
                              {commission.subscription_orders_included}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Cuota mensual:</span> ${commission.subscription_monthly_fee}
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin configuración de comisión</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
