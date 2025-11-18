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
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // vendor_id
    const error = url.searchParams.get('error');

    console.log('MercadoPago OAuth callback:', { code: !!code, state, error });

    if (error) {
      console.error('OAuth error:', error);
      const appUrl = Deno.env.get('APP_URL') || 'https://tu-app.lovable.app';
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${appUrl}/vendor?mp_error=${encodeURIComponent('Autorización cancelada o denegada')}`,
        },
      });
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vendorId = state;
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const redirectUri = Deno.env.get('MP_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing MercadoPago credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for tokens', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful:', { user_id: tokenData.user_id });

    // Calculate token expiration (6 months from now)
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 6);

    // Update vendor payment settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: vendor, error: fetchError } = await supabase
      .from('vendors')
      .select('payment_settings')
      .eq('id', vendorId)
      .single();

    if (fetchError) {
      console.error('Error fetching vendor:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch vendor', details: fetchError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentSettings = vendor.payment_settings || {};
    const updatedSettings = {
      ...currentSettings,
      mercadoPago: {
        activo: true,
        user_id: tokenData.user_id.toString(),
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        fecha_expiracion_token: expirationDate.toISOString(),
      },
    };

    const { error: updateError } = await supabase
      .from('vendors')
      .update({ payment_settings: updatedSettings })
      .eq('id', vendorId);

    if (updateError) {
      console.error('Error updating vendor:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update vendor settings', details: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('MercadoPago connected successfully for vendor:', vendorId);

    // Redirect to vendor dashboard with success message
    const appUrl = Deno.env.get('APP_URL') || 'https://tu-app.lovable.app';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${appUrl}/vendor?mp_connected=true`,
      },
    });

  } catch (error) {
    console.error('Error in MercadoPago OAuth callback:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://tu-app.lovable.app';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${appUrl}/vendor?mp_error=${encodeURIComponent(error.message)}`,
      },
    });
  }
});
