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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Use service role for cross-table queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check platform_admin role
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*, tenant_subscriptions(*)")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant users (WITHOUT broken profiles join)
    const { data: tenantUsers } = await supabase
      .from("tenant_users")
      .select("user_id, role, is_active")
      .eq("tenant_id", tenant_id);

    const userIds = (tenantUsers || []).map((u: any) => u.user_id);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({
          tenant,
          users: [],
          kpis: { leads: 0, customers: 0, quotations: 0, sales_orders: 0, invoices: 0, dispatches: 0, tasks: 0, total_revenue: 0, lead_conversion_rate: 0 },
          revenue_trend: [],
          lead_funnel: {},
          recent_activity: [],
          top_users: [],
          leads_list: [],
          customers_list: [],
          quotations_list: [],
          orders_list: [],
          invoices_list: [],
          tasks_list: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profiles separately and merge
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, phone")
      .in("id", userIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

    // Merge profiles into tenant users
    const usersWithProfiles = (tenantUsers || []).map((u: any) => ({
      ...u,
      profiles: profileMap[u.user_id] || null,
    }));

    // Run all queries in parallel
    const [
      leadsResult,
      customersResult,
      quotationsResult,
      ordersResult,
      invoicesResult,
      dispatchesResult,
      tasksResult,
      wonLeadsResult,
      recentActivityResult,
    ] = await Promise.all([
      supabase.from("leads").select("id, company_name, status, source, created_at, assigned_to").eq("tenant_id", tenant_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("customers").select("id, company_name, contact_person, phone, email, city, state, created_at, assigned_sales_id").eq("tenant_id", tenant_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("quotations").select("id, quotation_number, grand_total, status, is_converted, created_at, lead_id, created_by").eq("tenant_id", tenant_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("sales_orders").select("id, order_number, order_value, status, created_at, customer_id, created_by").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(200),
      supabase.from("invoices").select("id, invoice_number, total_amount, payment_status, invoice_date, created_at, created_by").in("created_by", userIds).order("created_at", { ascending: false }).limit(200),
      supabase.from("dispatches").select("id, dispatch_number, status, dispatch_date, created_at").in("dispatched_by", userIds).order("created_at", { ascending: false }).limit(200),
      supabase.from("tasks").select("id, title, status, priority, due_date, created_at, assigned_to").in("assigned_to", userIds).order("created_at", { ascending: false }).limit(200),
      supabase.from("leads").select("id").eq("tenant_id", tenant_id).is("deleted_at", null).eq("status", "won"),
      supabase.from("activity_logs").select("id, action, entity_type, entity_name, created_at, user_id").in("user_id", userIds).order("created_at", { ascending: false }).limit(20),
    ]);

    const leads = leadsResult.data || [];
    const customers = customersResult.data || [];
    const quotations = quotationsResult.data || [];
    const orders = ordersResult.data || [];
    const invoices = invoicesResult.data || [];
    const dispatches = dispatchesResult.data || [];
    const tasks = tasksResult.data || [];
    const wonLeads = wonLeadsResult.data || [];

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.order_value || 0), 0);
    const leadConversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

    // Lead funnel
    const leadFunnel: Record<string, number> = {};
    leads.forEach((l: any) => {
      leadFunnel[l.status] = (leadFunnel[l.status] || 0) + 1;
    });

    // Revenue trend (last 6 months)
    const revenueTrend: { month: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en", { month: "short", year: "2-digit" });
      const monthRevenue = orders
        .filter((o: any) => o.created_at?.startsWith(monthKey))
        .reduce((sum: number, o: any) => sum + (o.order_value || 0), 0);
      revenueTrend.push({ month: monthLabel, revenue: monthRevenue });
    }

    // Per-user stats
    const userRevenueMap: Record<string, number> = {};
    const userLeadMap: Record<string, number> = {};
    const userCustomerMap: Record<string, number> = {};
    const userQuotationMap: Record<string, number> = {};
    const userOrderMap: Record<string, number> = {};
    const userTaskMap: Record<string, number> = {};
    const userTaskDoneMap: Record<string, number> = {};

    orders.forEach((o: any) => {
      if (o.created_by) {
        userRevenueMap[o.created_by] = (userRevenueMap[o.created_by] || 0) + (o.order_value || 0);
        userOrderMap[o.created_by] = (userOrderMap[o.created_by] || 0) + 1;
      }
    });
    leads.forEach((l: any) => {
      if (l.assigned_to) userLeadMap[l.assigned_to] = (userLeadMap[l.assigned_to] || 0) + 1;
    });
    customers.forEach((c: any) => {
      if (c.assigned_sales_id) userCustomerMap[c.assigned_sales_id] = (userCustomerMap[c.assigned_sales_id] || 0) + 1;
    });
    quotations.forEach((q: any) => {
      if (q.created_by) userQuotationMap[q.created_by] = (userQuotationMap[q.created_by] || 0) + 1;
    });
    tasks.forEach((t: any) => {
      if (t.assigned_to) {
        userTaskMap[t.assigned_to] = (userTaskMap[t.assigned_to] || 0) + 1;
        if (t.status === "completed") {
          userTaskDoneMap[t.assigned_to] = (userTaskDoneMap[t.assigned_to] || 0) + 1;
        }
      }
    });

    const topUsers = usersWithProfiles.map((u: any) => ({
      user_id: u.user_id,
      name: u.profiles?.full_name || "Unknown",
      email: u.profiles?.email || "",
      avatar_url: u.profiles?.avatar_url || null,
      role: u.role,
      is_active: u.is_active,
      revenue: userRevenueMap[u.user_id] || 0,
      leads_count: userLeadMap[u.user_id] || 0,
      customers_count: userCustomerMap[u.user_id] || 0,
      quotations_count: userQuotationMap[u.user_id] || 0,
      orders_count: userOrderMap[u.user_id] || 0,
      tasks_count: userTaskMap[u.user_id] || 0,
      tasks_done: userTaskDoneMap[u.user_id] || 0,
    })).sort((a: any, b: any) => b.revenue - a.revenue);

    // Task stats
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((t: any) => t.status === "completed").length,
      pending: tasks.filter((t: any) => t.status === "pending").length,
      overdue: tasks.filter((t: any) => t.status !== "completed" && t.due_date && new Date(t.due_date) < now).length,
    };

    return new Response(
      JSON.stringify({
        tenant,
        users: usersWithProfiles,
        kpis: {
          leads: leads.length,
          customers: customers.length,
          quotations: quotations.length,
          sales_orders: orders.length,
          invoices: invoices.length,
          dispatches: dispatches.length,
          tasks: tasks.length,
          total_revenue: totalRevenue,
          lead_conversion_rate: leadConversionRate,
        },
        revenue_trend: revenueTrend,
        lead_funnel: leadFunnel,
        recent_activity: recentActivityResult.data || [],
        top_users: topUsers,
        task_stats: taskStats,
        leads_list: leads.slice(0, 50),
        customers_list: customers.slice(0, 50),
        quotations_list: quotations.slice(0, 50),
        orders_list: orders.slice(0, 50),
        invoices_list: invoices.slice(0, 50),
        tasks_list: tasks.slice(0, 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
