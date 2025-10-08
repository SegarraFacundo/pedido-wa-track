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

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      console.log('User already exists, using existing user:', existingUser.id);
      
      // Link vendor to existing user
      const { error: vendorUpdateError } = await supabaseAdmin
        .from('vendors')
        .update({ user_id: existingUser.id })
        .eq('id', vendorId);

      if (vendorUpdateError) {
        console.error('Error updating vendor:', vendorUpdateError);
        return new Response(
          JSON.stringify({ error: vendorUpdateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Assign vendor role if not exists
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ 
          user_id: existingUser.id, 
          role: 'vendor' 
        });

      if (roleError && roleError.code !== '23505') {
        console.error('Error assigning role:', roleError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id,
          message: 'Usuario existente vinculado exitosamente' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up any orphaned profile before creating new user
    console.log('Checking for orphaned profiles...');
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('email', email);
    
    if (profileDeleteError) {
      console.log('No orphaned profile or error deleting:', profileDeleteError);
    } else {
      console.log('Cleaned up orphaned profile');
    }

    // Create user in Auth without triggering auto-profile creation
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'vendor'
      },
      app_metadata: {
        provider: 'email',
        providers: ['email']
      }
    });

    if (userError) {
      console.error('Error creating user:', userError);
      console.error('Full error:', JSON.stringify(userError));
      return new Response(
        JSON.stringify({ error: userError.message, details: userError }),
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

    if (roleError && roleError.code !== '23505') {
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
