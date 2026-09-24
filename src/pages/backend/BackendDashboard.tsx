import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, CreditCard, LifeBuoy, TrendingUp, UserPlus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

function StatCard({ title, value, icon: Icon, color, change }: { title: string; value: string | number; icon: any; color: string; change?: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change)}% vs last month
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function BackendDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["backend-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "dashboard_stats" },
      });
      if (error) throw error;
      return data;
    },
  });

  const tenantCount = data?.tenant_count ?? 0;
  const userCount = data?.user_count ?? 0;
  const activeSubscriptions = data?.active_subscriptions ?? 0;
  const mrr = data?.mrr ?? 0;
  const newSignupsThisMonth = data?.new_signups ?? 0;
  const openTickets = data?.open_tickets ?? 0;
  const revenueTrend = data?.revenue_trend ?? [];
  const tenantGrowth = data?.tenant_growth ?? [];
  const recentActivity = data?.recent_activity ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Platform overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Tenants" value={tenantCount} icon={Building2} color="bg-blue-500/10 text-blue-400" />
        <StatCard title="Total Users" value={userCount} icon={Users} color="bg-violet-500/10 text-violet-400" />
        <StatCard title="Active Subscriptions" value={activeSubscriptions} icon={CreditCard} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard title="MRR" value={`₹${mrr.toLocaleString()}`} icon={TrendingUp} color="bg-amber-500/10 text-amber-400" />
        <StatCard title="New Signups (Month)" value={newSignupsThisMonth} icon={UserPlus} color="bg-cyan-500/10 text-cyan-400" />
        <StatCard title="Open Tickets" value={openTickets} icon={LifeBuoy} color="bg-red-500/10 text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue Trend (6 months)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Tenant Growth (6 months)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tenantGrowth}>
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="tenants" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-zinc-500 text-sm">No recent activity</p>
          ) : (
            recentActivity.map((event: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    event.type === 'tenant' ? 'bg-blue-400' :
                    event.type === 'subscription' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className="text-sm text-zinc-300">{event.description}</span>
                </div>
                <span className="text-xs text-zinc-500">{format(new Date(event.time), "MMM d, h:mm a")}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
