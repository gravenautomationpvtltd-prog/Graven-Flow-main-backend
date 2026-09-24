import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callingUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id);

    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = callerRoles?.some(r => r.role === 'super_admin' || r.role === 'coo');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's tenant_id
    const { data: callerTenant, error: tenantError } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', callingUser.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (tenantError || !callerTenant?.tenant_id) {
      console.error('Error fetching caller tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Could not determine your organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = callerTenant.tenant_id;

    // Enforce max_users limit
    const { data: tenantData, error: tenantDataError } = await supabaseAdmin
      .from('tenants')
      .select('max_users, subscription_status')
      .eq('id', tenantId)
      .single();

    if (tenantDataError) {
      console.error('Error fetching tenant data:', tenantDataError);
      return new Response(
        JSON.stringify({ error: 'Could not verify organization limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For trial tenants, enforce max 1 user (only the owner)
    const effectiveMaxUsers = tenantData.subscription_status === 'trial' ? 1 : (tenantData.max_users || 1);

    const { count: activeUserCount, error: countError } = await supabaseAdmin
      .from('tenant_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (countError) {
      console.error('Error counting active users:', countError);
      return new Response(
        JSON.stringify({ error: 'Could not verify user count' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((activeUserCount || 0) >= effectiveMaxUsers) {
      const message = tenantData.subscription_status === 'trial'
        ? 'Demo accounts are limited to 1 user. Please upgrade your subscription to add team members.'
        : `Your organization has reached its limit of ${effectiveMaxUsers} users. Please upgrade your subscription to add more team members.`;
      return new Response(
        JSON.stringify({ error: message, code: 'USER_LIMIT_REACHED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, fullName, role, officeId } = await req.json();

    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${callingUser.email} creating user: ${email} with role: ${role} in tenant: ${tenantId}`);

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    let newUserId: string;

    if (createError) {
      // Check if the error is "already registered"
      if (createError.message?.includes('already been registered')) {
        console.log(`User ${email} already exists, attempting to adopt into tenant ${tenantId}`);

        // Look up existing user by email from profiles table (fast, indexed)
        const { data: existingProfile, error: lookupError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (lookupError || !existingProfile) {
          return new Response(
            JSON.stringify({ error: 'User exists but could not be found. Please try again.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        newUserId = existingProfile.id;

        // Check if already in this tenant
        const { data: existingMembership } = await supabaseAdmin
          .from('tenant_users')
          .select('id')
          .eq('user_id', newUserId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existingMembership) {
          return new Response(
            JSON.stringify({ error: 'This user is already a member of your organization' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Adopting existing user ${newUserId} into tenant ${tenantId}`);
      } else {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      newUserId = userData.user.id;
    }

    console.log(`User ID: ${newUserId}`);

    // Update profile with office_id and tenant_id
    const profileUpdate: Record<string, unknown> = { tenant_id: tenantId };
    if (officeId) profileUpdate.office_id = officeId;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', newUserId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Assign app role (upsert to handle existing role)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: newUserId, role }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // Only delete user if we just created them
      if (!createError) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      }
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to tenant_users
    const { error: tenantUserError } = await supabaseAdmin
      .from('tenant_users')
      .upsert(
        { user_id: newUserId, tenant_id: tenantId, role: 'member', is_active: true },
        { onConflict: 'user_id,tenant_id', ignoreDuplicates: false }
      );

    if (tenantUserError) {
      console.error('Error adding to tenant_users:', tenantUserError);
    }

    console.log(`Role ${role} assigned and tenant membership created for user ${newUserId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUserId, 
          email,
          fullName 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
