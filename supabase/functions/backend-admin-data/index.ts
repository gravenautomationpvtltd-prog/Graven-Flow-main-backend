import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICING: Record<string, { perUser: number; months: number }> = {
  monthly: { perUser: 1500, months: 1 },
  half_yearly: { perUser: 1200, months: 6 },
  annual: { perUser: 750, months: 12 },
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller using getClaims
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const user = { id: claimsData.claims.sub as string };

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check platform_admin role
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "dashboard_stats": {
        const [
          tenantsRes,
          usersRes,
          activeSubsRes,
          allSubsRes,
          openTicketsRes,
          newSignupsRes,
        ] = await Promise.all([
          supabase.from("tenants").select("id, created_at").order("created_at"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("tenant_subscriptions").select("id", { count: "exact", head: true }).eq("payment_status", "active"),
          supabase.from("tenant_subscriptions").select("total_amount, created_at, payment_status, plan_type").order("created_at"),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("tenants").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        ]);

        const tenants = tenantsRes.data || [];
        const subs = allSubsRes.data || [];
        const mrr = subs.filter((s: any) => s.payment_status === "active").reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

        // Revenue trend (6 months)
        const revenueTrend: { month: string; revenue: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const monthLabel = d.toLocaleString("en", { month: "short", year: "2-digit" });
          const rev = subs.filter((s: any) => s.created_at?.startsWith(monthKey)).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
          revenueTrend.push({ month: monthLabel, revenue: rev });
        }

        // Tenant growth
        const tenantGrowth: { month: string; tenants: number }[] = [];
        let cum = 0;
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const monthLabel = d.toLocaleString("en", { month: "short", year: "2-digit" });
          const count = tenants.filter((t: any) => t.created_at?.startsWith(monthKey)).length;
          cum += count;
          tenantGrowth.push({ month: monthLabel, tenants: cum });
        }

        // Recent activity
        const [newTenantsRes, newTicketsRes, newSubsRes] = await Promise.all([
          supabase.from("tenants").select("company_name, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("support_tickets").select("subject, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("tenant_subscriptions").select("plan_type, created_at, tenants(company_name)").order("created_at", { ascending: false }).limit(5),
        ]);

        const events: any[] = [];
        (newTenantsRes.data || []).forEach((t: any) => events.push({ type: "tenant", description: `New tenant: ${t.company_name}`, time: t.created_at }));
        (newTicketsRes.data || []).forEach((t: any) => events.push({ type: "ticket", description: `Ticket: ${t.subject}`, time: t.created_at }));
        (newSubsRes.data || []).forEach((s: any) => events.push({ type: "subscription", description: `Subscription (${s.plan_type}): ${s.tenants?.company_name || "Unknown"}`, time: s.created_at }));
        events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        return json({
          tenant_count: tenants.length,
          user_count: usersRes.count || 0,
          active_subscriptions: activeSubsRes.count || 0,
          mrr,
          open_tickets: openTicketsRes.count || 0,
          new_signups: newSignupsRes.count || 0,
          revenue_trend: revenueTrend,
          tenant_growth: tenantGrowth,
          recent_activity: events.slice(0, 10),
        });
      }

      case "list_tenants": {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("*, tenant_subscriptions(*)")
          .order("created_at", { ascending: false });

        // Get user counts per tenant
        const tenantIds = (tenants || []).map((t: any) => t.id);
        const { data: tenantUsers } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .in("tenant_id", tenantIds.length > 0 ? tenantIds : ["__none__"]);

        const userCounts: Record<string, number> = {};
        (tenantUsers || []).forEach((tu: any) => {
          userCounts[tu.tenant_id] = (userCounts[tu.tenant_id] || 0) + 1;
        });

        const enriched = (tenants || []).map((t: any) => ({
          ...t,
          user_count: userCounts[t.id] || 0,
        }));

        return json({ tenants: enriched });
      }

      case "update_tenant_status": {
        const { tenant_id, new_status } = body;
        const { error } = await supabase.from("tenants").update({ subscription_status: new_status }).eq("id", tenant_id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "delete_tenant": {
        const { tenant_id } = body;
        const { error } = await supabase.from("tenants").delete().eq("id", tenant_id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "list_subscriptions": {
        const [subsRes, tenantsRes] = await Promise.all([
          supabase.from("tenant_subscriptions").select("*").order("created_at", { ascending: false }),
          supabase.from("tenants").select("id, company_name"),
        ]);

        const tenantMap: Record<string, string> = {};
        (tenantsRes.data || []).forEach((t: any) => { tenantMap[t.id] = t.company_name; });

        const enriched = (subsRes.data || []).map((s: any) => ({
          ...s,
          tenant_name: tenantMap[s.tenant_id] || "Unknown",
        }));

        // Also return tenant list for dropdowns
        return json({ subscriptions: enriched, tenants: tenantsRes.data || [] });
      }

      case "update_subscription_status": {
        const { subscription_id, new_status } = body;
        const { error } = await supabase.from("tenant_subscriptions").update({ payment_status: new_status }).eq("id", subscription_id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "extend_subscription": {
        const { subscription_id, days } = body;
        const { data: sub } = await supabase.from("tenant_subscriptions").select("end_date").eq("id", subscription_id).single();
        const currentEnd = sub?.end_date ? new Date(sub.end_date) : new Date();
        currentEnd.setDate(currentEnd.getDate() + days);
        const { error } = await supabase.from("tenant_subscriptions").update({ end_date: currentEnd.toISOString() }).eq("id", subscription_id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "create_subscription": {
        const { tenant_id, plan_type, user_count, start_date, end_date } = body;
        const pricing = PRICING[plan_type];
        if (!pricing) return json({ error: "Invalid plan_type" }, 400);
        const totalAmount = user_count * pricing.perUser * pricing.months;
        const { error } = await supabase.from("tenant_subscriptions").insert({
          tenant_id,
          plan_type,
          user_count,
          price_per_user: pricing.perUser,
          total_amount: totalAmount,
          start_date: start_date || new Date().toISOString(),
          end_date: end_date || null,
          payment_status: "active",
        });
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "generate_payment_link": {
        const { tenant_id, plan_type, user_count } = body;
        const pricing = PRICING[plan_type];
        if (!pricing) return json({ error: "Invalid plan_type" }, 400);

        const totalAmount = user_count * pricing.perUser * pricing.months;
        const amountInPaise = totalAmount * 100;

        const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
          return json({ error: "Razorpay credentials not configured" }, 500);
        }

        // Create Razorpay order (same as working razorpay-checkout)
        const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: tenant_id,
            notes: { plan_type, user_count: String(user_count), tenant_id },
          }),
        });

        if (!razorpayRes.ok) {
          const err = await razorpayRes.text();
          console.error("Razorpay order error:", err);
          return json({ error: "Failed to create payment order" }, 500);
        }

        const orderData = await razorpayRes.json();

        // Get tenant name for the payment link
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("company_name")
          .eq("id", tenant_id)
          .single();

        // Store pending subscription
        await supabase.from("tenant_subscriptions").insert({
          tenant_id,
          plan_type,
          user_count,
          price_per_user: pricing.perUser,
          total_amount: totalAmount,
          payment_status: "pending",
          razorpay_order_id: orderData.id,
        });

        // Construct shareable payment URL (new format with tenant_id for dynamic pricing)
        const origin = req.headers.get("origin") || "https://gravenonedesk.com";
        const tenantLabel = encodeURIComponent(tenantData?.company_name || "");
        const paymentUrl = `${origin}/pay?key=${RAZORPAY_KEY_ID}&plan=${plan_type}&users=${user_count}&tenant=${tenantLabel}&tenant_id=${tenant_id}`;

        return json({
          order_id: orderData.id,
          amount: totalAmount,
          amount_paise: amountInPaise,
          currency: "INR",
          key_id: RAZORPAY_KEY_ID,
          payment_url: paymentUrl,
        });
      }

      case "analytics_data": {
        const [tenantsRes, usersRes, subsRes] = await Promise.all([
          supabase.from("tenants").select("created_at").order("created_at"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("tenant_subscriptions").select("payment_status, total_amount, plan_type, created_at"),
        ]);

        return json({
          tenants: tenantsRes.data || [],
          user_count: usersRes.count || 0,
          subscriptions: subsRes.data || [],
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("backend-admin-data error:", err);
    return json({ error: err.message }, 500);
  }
});
