import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── Input validation ──
    const { orderId } = await req.json();

    if (!orderId || typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return new Response(
        JSON.stringify({ error: 'Valid Order ID (UUID) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating payment link for order:', orderId);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, vendors(payment_settings)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentSettings = order.vendors?.payment_settings || {};

    // Try MercadoPago first
    if (paymentSettings.mercadoPago?.activo && paymentSettings.mercadoPago.access_token) {
      const items = Array.isArray(order.items) ? order.items : [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
      const deliveryCost = parseFloat(order.total) - subtotal;

      const mpItems = items.map((item: any) => ({
        title: (item.product_name || item.name || 'Producto').substring(0, 256),
        quantity: item.quantity || 1,
        unit_price: parseFloat(item.price || 0),
      }));

      if (deliveryCost > 0) {
        mpItems.push({ title: '🚚 Costo de Delivery', quantity: 1, unit_price: parseFloat(deliveryCost.toFixed(2)) });
      }

      const preferenceData = {
        items: mpItems,
        payer: { name: order.customer_name, phone: { number: order.customer_phone } },
        back_urls: {
          success: `${Deno.env.get('APP_URL')}/payment-confirmation?orderId=${orderId}&status=success`,
          failure: `${Deno.env.get('APP_URL')}/payment-confirmation?orderId=${orderId}&status=failure`,
          pending: `${Deno.env.get('APP_URL')}/payment-confirmation?orderId=${orderId}&status=pending`,
        },
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
        external_reference: orderId,
        auto_return: 'approved',
      };

      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paymentSettings.mercadoPago.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferenceData),
      });

      if (mpResponse.ok) {
        const preference = await mpResponse.json();
        return new Response(
          JSON.stringify({ success: true, method: 'mercadopago', payment_link: preference.init_point, preference_id: preference.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback
    const availableMethods = [];
    if (paymentSettings.transferencia?.activo) {
      availableMethods.push({
        method: 'transferencia',
        details: { alias: paymentSettings.transferencia.alias, cbu: paymentSettings.transferencia.cbu, titular: paymentSettings.transferencia.titular, amount: order.total },
      });
    }
    if (paymentSettings.efectivo) {
      availableMethods.push({ method: 'efectivo', details: { amount: order.total, message: 'Pago en efectivo al recibir el pedido' } });
    }

    if (availableMethods.length === 0) {
      return new Response(JSON.stringify({ error: 'No payment methods available' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, available_methods: availableMethods }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating payment link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
