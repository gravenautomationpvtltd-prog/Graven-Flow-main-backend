import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths } from "date-fns";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function BackendAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["backend-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "analytics_data" },
      });
      if (error) throw error;
      return data;
    },
  });

  const tenants = data?.tenants || [];
  const userCount = data?.user_count || 0;
  const subscriptions = data?.subscriptions || [];

  const activeSubs = subscriptions.filter((s: any) => s.payment_status === "active").length;
  const totalSubs = subscriptions.length;
  const churnRate = totalSubs > 0
    ? ((subscriptions.filter((s: any) => s.payment_status === "expired" || s.payment_status === "cancelled").length / totalSubs) * 100).toFixed(1)
    : "0";
  const avgRevenuePerTenant = tenants.length > 0
    ? Math.round(subscriptions.reduce((s: number, sub: any) => s + (sub.total_amount || 0), 0) / tenants.length)
    : 0;

  const metrics = [
    { label: "Total Tenants", value: tenants.length },
    { label: "Total Users", value: userCount },
    { label: "Active Subscriptions", value: activeSubs },
    { label: "Churn Rate", value: `${churnRate}%` },
    { label: "Avg Revenue/Tenant", value: `₹${avgRevenuePerTenant.toLocaleString()}` },
  ];

  // MRR Trend
  const mrrTrend = (() => {
    const monthMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) monthMap[format(subMonths(new Date(), i), "MMM yy")] = 0;
    subscriptions.filter((s: any) => s.payment_status === 'active').forEach((s: any) => {
      const key = format(new Date(s.created_at), "MMM yy");
      if (key in monthMap) monthMap[key] += s.total_amount || 0;
    });
    return Object.entries(monthMap).map(([month, mrr]) => ({ month, mrr }));
  })();

  // Tenant Growth
  const tenantGrowthData = (() => {
    const monthMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) monthMap[format(subMonths(new Date(), i), "MMM yy")] = 0;
    tenants.forEach((t: any) => {
      const key = format(new Date(t.created_at), "MMM yy");
      if (key in monthMap) monthMap[key]++;
    });
    let cum = 0;
    return Object.entries(monthMap).map(([month, count]) => { cum += count; return { month, tenants: cum }; });
  })();

  // Subscription distribution pie
  const planDistribution = (() => {
    const dist: Record<string, number> = {};
    subscriptions.forEach((s: any) => {
      const plan = s.plan_type || 'unknown';
      dist[plan] = (dist[plan] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  })();

  // Churn over time
  const churnData = (() => {
    const monthMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) monthMap[format(subMonths(new Date(), i), "MMM yy")] = 0;
    subscriptions.filter((s: any) => s.payment_status === 'expired' || s.payment_status === 'cancelled').forEach((s: any) => {
      const key = format(new Date(s.created_at), "MMM yy");
      if (key in monthMap) monthMap[key]++;
    });
    return Object.entries(monthMap).map(([month, churned]) => ({ month, churned }));
  })();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-zinc-400 text-sm mt-1">Platform-level KPIs and metrics</p>
      </div>

      {isLoading ? (
        <p className="text-zinc-500">Loading analytics...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {metrics.map((m) => (
              <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{m.label}</p>
                <p className="text-xl font-bold text-white mt-2">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">MRR Trend</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mrrTrend}>
                    <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                    <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Tenant Growth</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tenantGrowthData}>
                    <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                    <Area type="monotone" dataKey="tenants" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Subscription Distribution</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {planDistribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Churn Over Time</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={churnData}>
                    <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                    <Bar dataKey="churned" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
