import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating payment link for order:', orderId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, vendors(payment_settings)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentSettings = order.vendors?.payment_settings || {};
    console.log('Payment settings:', paymentSettings);

    // Try MercadoPago first
    if (paymentSettings.mercadoPago?.activo && paymentSettings.mercadoPago.access_token) {
      console.log('Creating MercadoPago preference...');
      
      const items = Array.isArray(order.items) ? order.items : [];
      const preferenceData = {
        items: items.map((item: any) => ({
          title: item.name || 'Producto',
          quantity: item.quantity || 1,
          unit_price: item.price || 0,
        })),
        payer: {
          name: order.customer_name,
          phone: {
            number: order.customer_phone,
          },
        },
        back_urls: {
          success: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook?order_id=${orderId}`,
          failure: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook?order_id=${orderId}`,
          pending: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook?order_id=${orderId}`,
        },
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
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
        console.log('MercadoPago preference created:', preference.id);
        
        return new Response(
          JSON.stringify({
            success: true,
            method: 'mercadopago',
            payment_link: preference.init_point,
            preference_id: preference.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const error = await mpResponse.text();
        console.error('MercadoPago API error:', error);
      }
    }

    // Fallback to transfer or cash
    const availableMethods = [];
    
    if (paymentSettings.transferencia?.activo) {
      availableMethods.push({
        method: 'transferencia',
        details: {
          alias: paymentSettings.transferencia.alias,
          cbu: paymentSettings.transferencia.cbu,
          titular: paymentSettings.transferencia.titular,
          amount: order.total,
        },
      });
    }

    if (paymentSettings.efectivo) {
      availableMethods.push({
        method: 'efectivo',
        details: {
          amount: order.total,
          message: 'Pago en efectivo al recibir el pedido',
        },
      });
    }

    if (availableMethods.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No payment methods available for this vendor' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Returning alternative payment methods:', availableMethods.length);

    return new Response(
      JSON.stringify({
        success: true,
        available_methods: availableMethods,
      }),
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
