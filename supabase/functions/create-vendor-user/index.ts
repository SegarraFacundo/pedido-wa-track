import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, password, vendorId } = await req.json();

    console.log('Creating user with email:', email);

    // Create user in Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for vendors
      user_metadata: {
        role: 'vendor'
      }
    });

    if (userError) {
      console.error('Error creating user:', userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', userData.user.id);

    // Link vendor to user
    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update({ user_id: userData.user.id })
      .eq('id', vendorId);

    if (vendorUpdateError) {
      console.error('Error updating vendor:', vendorUpdateError);
      return new Response(
        JSON.stringify({ error: vendorUpdateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Vendor linked to user');

    // Assign vendor role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ 
        user_id: userData.user.id, 
        role: 'vendor' 
      });

    if (roleError && roleError.code !== '23505') { // Ignore duplicate key error
      console.error('Error assigning role:', roleError);
    }

    console.log('Vendor role assigned');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userData.user.id,
        message: 'Usuario creado y vinculado exitosamente' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
