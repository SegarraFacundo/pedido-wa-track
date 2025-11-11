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
    const body = await req.json();
    console.log('MercadoPago webhook received:', JSON.stringify(body, null, 2));

    // MercadoPago sends different types of notifications
    if (body.type === 'payment') {
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

      // Get payment details from MercadoPago
      // Note: We need the vendor's access token to fetch payment details
      // For now, we'll just log and acknowledge the webhook
      console.log('Payment webhook acknowledged, payment ID:', paymentId);

      // In a production environment, you would:
      // 1. Store the payment_id in your orders table
      // 2. Fetch payment details using the vendor's access_token
      // 3. Update order status based on payment status
      // 4. Send notification to vendor

      return new Response(
        JSON.stringify({ received: true, payment_id: paymentId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other notification types, just acknowledge
    console.log('Webhook type not handled:', body.type);
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
