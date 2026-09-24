import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Edge Runtime Main Service Dispatcher started");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-api-version, x-razorpay-signature",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Normalize path to support both /functions/v1/<name> and /<name>
  const normalizedPath = url.pathname.replace(/^\/functions\/v1\/?/, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  const service_name = parts[0]?.split("?")[0];

  if (!service_name) {
    return new Response(
      JSON.stringify({ error: "Missing function name in request URL" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const servicePath = `/home/deno/functions/${service_name}`;
  console.log(`[EdgeRuntime] Dispatching request for ${service_name} (${req.method} ${url.pathname})`);

  const memoryLimitMb = 150;
  const workerTimeoutMs = 60 * 1000;
  const noModuleCache = false;

  const envVarsObj: Record<string, string> = {
    ...Deno.env.toObject(),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "http://kong:8000",
    SUPABASE_FUNCTION_SLUG: service_name,
  };
  const envVars = Object.entries(envVarsObj);

  try {
    // @ts-ignore: EdgeRuntime is provided globally by the supabase/edge-runtime container
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      envVars,
    });
    return await worker.fetch(req);
  } catch (err: any) {
    console.error(`[EdgeRuntime] Error executing ${service_name}:`, err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
