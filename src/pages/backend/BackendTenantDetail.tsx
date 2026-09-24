import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Building2, Users, TrendingUp, FileText, ShoppingCart,
  Receipt, Truck, CheckSquare, Ban, CheckCircle, Trash2, Clock,
  IndianRupee, Target, BarChart3, Mail, Phone, MapPin, Globe,
  ChevronDown, ChevronRight
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function KpiCard({ icon: Icon, label, value, color, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`bg-zinc-900 border rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
        active ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-zinc-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </button>
  );
}

function DrillTable({ title, columns, data }: { title: string; columns: { key: string; label: string; render?: (v: any, row: any) => any }[]; data: any[] }) {
  const [search, setSearch] = useState("");
  const filtered = data.filter((row) =>
    columns.some((col) => String(row[col.key] || "").toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 h-8 bg-zinc-800 border-zinc-700 text-white text-xs"
        />
      </div>
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {columns.map((col) => (
                <th key={col.key} className="text-left px-3 py-2 text-xs text-zinc-400 font-medium uppercase">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-zinc-500">No data</td></tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id || i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-zinc-300">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BackendTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-org-data", id],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("tenant-org-data", {
        body: { tenant_id: id },
      });
      if (error) throw error;
      return result;
    },
    enabled: !!id,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: "active" | "cancelled" | "expired" | "trial") => {
      const { error } = await supabase.from("tenants").update({ subscription_status: newStatus }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-org-data", id] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const extendTrialMutation = useMutation({
    mutationFn: async (days: number) => {
      const currentEnd = data?.tenant?.trial_end_date ? new Date(data.tenant.trial_end_date) : new Date();
      currentEnd.setDate(currentEnd.getDate() + days);
      const { error } = await supabase.from("tenants").update({
        trial_end_date: currentEnd.toISOString(),
        subscription_status: "trial",
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-org-data", id] });
      toast.success("Trial extended");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tenant deleted");
      navigate("/backend/tenants");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Failed to load tenant data</p>
        <Button variant="outline" onClick={() => navigate("/backend/tenants")} className="border-zinc-700 text-zinc-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tenants
        </Button>
      </div>
    );
  }

  const { tenant, kpis, revenue_trend, lead_funnel, recent_activity, top_users, task_stats, users } = data;
  const isActive = tenant.subscription_status === "active" || tenant.subscription_status === "trial";

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400",
    trial: "bg-amber-500/10 text-amber-400",
    cancelled: "bg-red-500/10 text-red-400",
    expired: "bg-zinc-500/10 text-zinc-400",
  };

  const funnelData = Object.entries(lead_funnel || {}).map(([status, count]) => ({
    status,
    count: count as number,
  })).sort((a, b) => b.count - a.count);

  const handleKpiClick = (kpi: string) => {
    setActiveKpi(activeKpi === kpi ? null : kpi);
    setActiveTab("drill");
  };

  const renderDrillDown = () => {
    switch (activeKpi) {
      case "revenue":
        return <DrillTable title="Sales Orders (Revenue)" columns={[
          { key: "order_number", label: "Order #" },
          { key: "order_value", label: "Value", render: (v: number) => `₹${(v || 0).toLocaleString()}` },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Date", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.orders_list || []} />;
      case "leads":
        return <DrillTable title="Leads" columns={[
          { key: "company_name", label: "Company" },
          { key: "status", label: "Status", render: (v: string) => <span className={`px-2 py-0.5 rounded text-xs ${v === "won" ? "bg-emerald-500/10 text-emerald-400" : v === "lost" ? "bg-red-500/10 text-red-400" : "bg-zinc-500/10 text-zinc-400"}`}>{v}</span> },
          { key: "source", label: "Source" },
          { key: "created_at", label: "Date", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.leads_list || []} />;
      case "customers":
        return <DrillTable title="Customers" columns={[
          { key: "company_name", label: "Company" },
          { key: "contact_person", label: "Contact" },
          { key: "phone", label: "Phone" },
          { key: "city", label: "City" },
          { key: "created_at", label: "Created", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.customers_list || []} />;
      case "quotations":
        return <DrillTable title="Quotations" columns={[
          { key: "quotation_number", label: "Quote #" },
          { key: "grand_total", label: "Total", render: (v: number) => `₹${(v || 0).toLocaleString()}` },
          { key: "status", label: "Status" },
          { key: "is_converted", label: "Converted", render: (v: boolean) => v ? "✅" : "—" },
          { key: "created_at", label: "Date", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.quotations_list || []} />;
      case "invoices":
        return <DrillTable title="Invoices" columns={[
          { key: "invoice_number", label: "Invoice #" },
          { key: "total_amount", label: "Amount", render: (v: number) => `₹${(v || 0).toLocaleString()}` },
          { key: "payment_status", label: "Payment" },
          { key: "invoice_date", label: "Date", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.invoices_list || []} />;
      case "tasks":
        return <DrillTable title="Tasks" columns={[
          { key: "title", label: "Task" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "due_date", label: "Due", render: (v: string) => v ? format(new Date(v), "dd MMM yyyy") : "—" },
        ]} data={data.tasks_list || []} />;
      default:
        return <p className="text-zinc-500 text-center py-8">Click a KPI card above to drill down</p>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/backend/tenants")} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{tenant.company_name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[tenant.subscription_status] || statusColor.expired}`}>
                {tenant.subscription_status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
              {tenant.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {tenant.email}</span>}
              {tenant.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {tenant.phone}</span>}
              {(tenant.city || tenant.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[tenant.city, tenant.state].filter(Boolean).join(", ")}</span>}
              {tenant.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {tenant.website}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="w-16 h-8 bg-zinc-800 border-zinc-700 text-white text-xs" />
            <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-zinc-300 text-xs" onClick={() => extendTrialMutation.mutate(Number(extendDays))}>
              <Clock className="h-3 w-3 mr-1" /> Extend Trial
            </Button>
          </div>
          <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-zinc-300 text-xs" onClick={() => toggleStatusMutation.mutate(isActive ? "cancelled" : "active")}>
            {isActive ? <Ban className="h-3 w-3 mr-1 text-red-400" /> : <CheckCircle className="h-3 w-3 mr-1 text-emerald-400" />}
            {isActive ? "Suspend" : "Activate"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-red-400 text-xs" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon={IndianRupee} label="Revenue" value={`₹${(kpis.total_revenue || 0).toLocaleString()}`} color="text-emerald-400" active={activeKpi === "revenue"} onClick={() => handleKpiClick("revenue")} />
        <KpiCard icon={Target} label="Leads" value={kpis.leads} color="text-blue-400" active={activeKpi === "leads"} onClick={() => handleKpiClick("leads")} />
        <KpiCard icon={Users} label="Customers" value={kpis.customers} color="text-purple-400" active={activeKpi === "customers"} onClick={() => handleKpiClick("customers")} />
        <KpiCard icon={FileText} label="Quotations" value={kpis.quotations} color="text-amber-400" active={activeKpi === "quotations"} onClick={() => handleKpiClick("quotations")} />
        <KpiCard icon={ShoppingCart} label="Orders" value={kpis.sales_orders} color="text-cyan-400" active={activeKpi === "revenue"} onClick={() => handleKpiClick("revenue")} />
        <KpiCard icon={Receipt} label="Invoices" value={kpis.invoices} color="text-pink-400" active={activeKpi === "invoices"} onClick={() => handleKpiClick("invoices")} />
        <KpiCard icon={CheckSquare} label="Tasks" value={kpis.tasks} color="text-lime-400" active={activeKpi === "tasks"} onClick={() => handleKpiClick("tasks")} />
      </div>

      {/* Conversion Rate Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-sm text-zinc-400">Lead Conversion Rate</p>
            <p className="text-2xl font-bold text-white">{kpis.lead_conversion_rate}%</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <span>Users: <strong className="text-white">{users?.length || 0}</strong></span>
          <span>Dispatches: <strong className="text-white">{kpis.dispatches}</strong></span>
          <span>Tasks Done: <strong className="text-white">{task_stats?.completed || 0}/{task_stats?.total || 0}</strong></span>
          {tenant.trial_end_date && <span>Trial Ends: <strong className="text-white">{format(new Date(tenant.trial_end_date), "dd MMM yyyy")}</strong></span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">Overview</TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">Team ({users?.length || 0})</TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">Subscriptions</TabsTrigger>
          <TabsTrigger value="drill" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            {activeKpi ? `📊 ${activeKpi.charAt(0).toUpperCase() + activeKpi.slice(1)}` : "Drill Down"}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Revenue Trend (6 months)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Lead Funnel */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Lead Funnel</h3>
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis type="category" dataKey="status" tick={{ fill: "#71717a", fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {funnelData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-zinc-500 text-center py-12">No lead data</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(recent_activity || []).length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No recent activity</p>
              ) : (
                (recent_activity || []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs font-medium text-emerald-400">{a.action}</span>
                      <span className="text-xs text-zinc-400 ml-2">{a.entity_type}: {a.entity_name || "—"}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{a.created_at ? format(new Date(a.created_at), "dd MMM, HH:mm") : ""}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Users/Team Tab */}
        <TabsContent value="users" className="mt-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="w-8 px-2"></th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase">Revenue</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase">Leads</th>
                </tr>
              </thead>
              <tbody>
                {(top_users || []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No users</td></tr>
                ) : (
                  (top_users || []).map((u: any) => {
                    const isExpanded = expandedUser === u.user_id;
                    return (
                      <>
                        <tr
                          key={u.user_id}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                          onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}
                        >
                          <td className="px-2 py-3 text-zinc-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{u.name}</p>
                            <p className="text-xs text-zinc-400">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-zinc-300 capitalize bg-zinc-800 px-2 py-0.5 rounded">{u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${u.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">₹{(u.revenue || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-zinc-300">{u.leads_count || 0}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${u.user_id}-detail`} className="bg-zinc-800/20">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Leads</p>
                                  <p className="text-lg font-bold text-blue-400">{u.leads_count || 0}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Customers</p>
                                  <p className="text-lg font-bold text-purple-400">{u.customers_count || 0}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Quotations</p>
                                  <p className="text-lg font-bold text-amber-400">{u.quotations_count || 0}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Orders</p>
                                  <p className="text-lg font-bold text-cyan-400">{u.orders_count || 0}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Revenue</p>
                                  <p className="text-lg font-bold text-emerald-400">₹{(u.revenue || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-zinc-400 mb-1">Tasks Done</p>
                                  <p className="text-lg font-bold text-lime-400">{u.tasks_done || 0}/{u.tasks_count || 0}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4">
          <div className="space-y-3">
            {(tenant.tenant_subscriptions || []).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No subscriptions</div>
            ) : (
              (tenant.tenant_subscriptions || []).map((sub: any) => (
                <div key={sub.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium capitalize">{sub.plan_type} Plan</p>
                      <p className="text-xs text-zinc-400">{sub.user_count} users × ₹{sub.price_per_user}/user</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">₹{(sub.total_amount || 0).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${sub.payment_status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                      {sub.payment_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Drill Down Tab */}
        <TabsContent value="drill" className="mt-4">
          {renderDrillDown()}
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tenant.company_name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
