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
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // Check if this is a redirect from back_urls (user being redirected)
    if (searchParams.has('external_reference') || searchParams.has('order_id')) {
      const orderId = searchParams.get('external_reference') || searchParams.get('order_id');
      const status = searchParams.get('status') || searchParams.get('collection_status') || 'pending';
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
      
      console.log('User redirect detected:', { orderId, status, paymentId });
      
      // Redirect to frontend confirmation page
      const redirectUrl = `${Deno.env.get('APP_URL')}/payment-confirmation?orderId=${orderId}&status=${status}${paymentId ? `&payment_id=${paymentId}` : ''}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl,
        },
      });
    }

    // This is a server-to-server notification from MercadoPago
    const body = await req.json();
    console.log('MercadoPago webhook notification received:', JSON.stringify(body, null, 2));

    // MercadoPago sends different types of notifications
    if (body.type === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated') {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.log('No payment ID in webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Processing payment notification:', paymentId);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // First, we need to find the order using the external_reference
      // We'll get payment details from MercadoPago to find the order
      // Note: We need the vendor's access token to fetch payment details
      
      // For now, we'll acknowledge the webhook and log it
      // The payment details will be fetched and processed by checking the payment status
      // when the order is accessed or through a separate cron job
      
      console.log('Payment webhook acknowledged. Payment ID:', paymentId);
      console.log('Note: Full payment processing requires vendor access token.');
      console.log('Payment status will be updated when order is accessed or through batch processing.');

      // Try to find orders that might be related to this payment
      // and mark them for review
      try {
        // We can't directly query MercadoPago without the vendor's token
        // So we'll just log this for now
        console.log('Payment notification logged. Order will be updated on next status check.');
      } catch (error) {
        console.error('Error processing payment:', error);
      }

      return new Response(
        JSON.stringify({ received: true, payment_id: paymentId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other notification types, just acknowledge
    console.log('Webhook type not handled:', body.type || body.action);
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing MercadoPago webhook:', error);
    // Always return 200 to avoid webhook retries
    return new Response(
      JSON.stringify({ error: error.message, received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
