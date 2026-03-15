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
    // ── Auth check: require admin ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service client
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Input validation ──
    const body = await req.json();
    const { email, password, vendorId } = body;

    if (!email || typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 100) {
      return new Response(JSON.stringify({ error: 'Password must be 8-100 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!vendorId || typeof vendorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
      return new Response(JSON.stringify({ error: 'Invalid vendor ID format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Creating user with email:', email);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      console.log('User already exists, using existing user:', existingUser.id);
      
      const { error: vendorUpdateError } = await supabaseAdmin
        .from('vendors')
        .update({ user_id: existingUser.id })
        .eq('id', vendorId);

      if (vendorUpdateError) {
        return new Response(JSON.stringify({ error: vendorUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: existingUser.id, role: 'vendor' });

      if (roleError && roleError.code !== '23505') {
        console.error('Error assigning role:', roleError);
      }

      return new Response(
        JSON.stringify({ success: true, userId: existingUser.id, message: 'Usuario existente vinculado exitosamente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up orphaned profile
    await supabaseAdmin.from('profiles').delete().eq('email', email);

    // Create user in Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'vendor' },
      app_metadata: { provider: 'email', providers: ['email'] }
    });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('User created:', userData.user.id);

    await supabaseAdmin.from('profiles').insert({ id: userData.user.id, email, role: 'vendor' });

    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update({ user_id: userData.user.id })
      .eq('id', vendorId);

    if (vendorUpdateError) {
      return new Response(JSON.stringify({ error: vendorUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userData.user.id, role: 'vendor' });

    if (roleError && roleError.code !== '23505') {
      console.error('Error assigning role:', roleError);
    }

    return new Response(
      JSON.stringify({ success: true, userId: userData.user.id, message: 'Usuario creado y vinculado exitosamente' }),
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
