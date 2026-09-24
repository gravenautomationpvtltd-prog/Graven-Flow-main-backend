import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active tenants
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id');

    if (tenantError) throw tenantError;

    let totalUpdated = 0;

    for (const tenant of tenants || []) {
      const { data, error } = await supabase.rpc('auto_segment_customers', {
        p_tenant_id: tenant.id,
      });

      if (error) {
        console.error(`Error segmenting tenant ${tenant.id}:`, error);
        continue;
      }

      totalUpdated += (data as any)?.customers_updated || 0;
    }

    return new Response(
      JSON.stringify({ success: true, customers_updated: totalUpdated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auto-segment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
