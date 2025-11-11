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
    console.log('Starting MercadoPago token refresh job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing MercadoPago credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find vendors with MercadoPago active
    const { data: vendors, error: fetchError } = await supabase
      .from('vendors')
      .select('id, payment_settings')
      .not('payment_settings->mercadoPago->refresh_token', 'is', null);

    if (fetchError) {
      console.error('Error fetching vendors:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${vendors?.length || 0} vendors with MercadoPago connected`);

    const results = {
      total: vendors?.length || 0,
      refreshed: 0,
      errors: 0,
    };

    if (!vendors || vendors.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No vendors to refresh', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh tokens for each vendor
    for (const vendor of vendors) {
      try {
        const paymentSettings = vendor.payment_settings;
        const refreshToken = paymentSettings?.mercadoPago?.refresh_token;

        if (!refreshToken) {
          console.log(`Skipping vendor ${vendor.id}: no refresh token`);
          continue;
        }

        console.log(`Refreshing token for vendor ${vendor.id}...`);

        const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`Token refresh failed for vendor ${vendor.id}:`, errorText);
          
          // Log the error
          await supabase.from('mercadopago_token_refresh_log').insert({
            vendor_id: vendor.id,
            success: false,
            error_message: errorText,
          });
          
          results.errors++;
          continue;
        }

        const tokenData = await tokenResponse.json();

        // Calculate new expiration date (6 months from now)
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 6);

        // Update vendor settings
        const updatedSettings = {
          ...paymentSettings,
          mercadoPago: {
            ...paymentSettings.mercadoPago,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            fecha_expiracion_token: expirationDate.toISOString(),
          },
        };

        const { error: updateError } = await supabase
          .from('vendors')
          .update({ payment_settings: updatedSettings })
          .eq('id', vendor.id);

        if (updateError) {
          console.error(`Error updating vendor ${vendor.id}:`, updateError);
          
          await supabase.from('mercadopago_token_refresh_log').insert({
            vendor_id: vendor.id,
            success: false,
            error_message: updateError.message,
          });
          
          results.errors++;
          continue;
        }

        // Log success
        await supabase.from('mercadopago_token_refresh_log').insert({
          vendor_id: vendor.id,
          success: true,
        });

        console.log(`Token refreshed successfully for vendor ${vendor.id}`);
        results.refreshed++;

      } catch (error) {
        console.error(`Error processing vendor ${vendor.id}:`, error);
        
        await supabase.from('mercadopago_token_refresh_log').insert({
          vendor_id: vendor.id,
          success: false,
          error_message: error.message,
        });
        
        results.errors++;
      }
    }

    console.log('Token refresh job completed:', results);

    return new Response(
      JSON.stringify({
        message: 'Token refresh completed',
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in token refresh job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
