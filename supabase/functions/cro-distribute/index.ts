import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional stale_days from body
    let staleDays = 60;
    try {
      const body = await req.json();
      if (body?.stale_days && typeof body.stale_days === "number") {
        staleDays = body.stale_days;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Get all tenants (no is_active column — all tenants are active)
    const { data: tenants, error: tenantError } = await supabase
      .from("tenants")
      .select("id, company_name");

    if (tenantError) {
      throw new Error(`Failed to fetch tenants: ${tenantError.message}`);
    }

    const results: Array<{ tenant_id: string; tenant_name: string; result: unknown }> = [];

    for (const tenant of tenants || []) {
      const { data, error } = await supabase.rpc("distribute_customers_to_cros", {
        p_tenant_id: tenant.id,
        p_stale_days: staleDays,
      });

      results.push({
        tenant_id: tenant.id,
        tenant_name: tenant.company_name,
        result: error ? { status: "error", message: error.message } : data,
      });
    }

    console.log("CRO distribution complete:", JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, stale_days: staleDays, tenants_processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("CRO distribution error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
