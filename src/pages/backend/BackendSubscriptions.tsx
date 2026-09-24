import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_FILTERS = ["all", "active", "pending", "expired"] as const;

export default function BackendSubscriptions() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", plan_type: "monthly", num_users: "1", start_date: "", end_date: "" });
  const [linkForm, setLinkForm] = useState({ tenant_id: "", plan_type: "monthly", num_users: "1" });

  const { data, isLoading } = useQuery({
    queryKey: ["backend-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "list_subscriptions" },
      });
      if (error) throw error;
      return data;
    },
  });

  const subscriptions = data?.subscriptions || [];
  const allTenants = data?.tenants || [];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "update_subscription_status", subscription_id: id, new_status: status },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-subscriptions"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const extendMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "extend_subscription", subscription_id: id, days },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-subscriptions"] });
      toast.success("Subscription extended");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: {
          action: "create_subscription",
          tenant_id: form.tenant_id,
          plan_type: form.plan_type,
          user_count: Number(form.num_users),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-subscriptions"] });
      setCreateOpen(false);
      toast.success("Subscription created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: {
          action: "generate_payment_link",
          tenant_id: linkForm.tenant_id,
          plan_type: linkForm.plan_type,
          user_count: Number(linkForm.num_users),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedLink(data.payment_url || `Order: ${data.order_id}`);
      queryClient.invalidateQueries({ queryKey: ["backend-subscriptions"] });
      toast.success(`Payment link generated! Amount: ₹${data.amount?.toLocaleString()}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalRevenue = subscriptions.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
  const activeSubs = subscriptions.filter((s: any) => s.payment_status === "active").length;
  const filtered = statusFilter === "all" ? subscriptions : subscriptions.filter((s: any) => s.payment_status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-zinc-400 text-sm mt-1">{subscriptions.length} total · {activeSubs} active · ₹{totalRevenue.toLocaleString()} revenue</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setGeneratedLink(null); setPaymentLinkOpen(true); }} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <Link2 className="h-4 w-4 mr-2" />Payment Link
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />New Subscription
          </Button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
              statusFilter === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Tenant</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Payment</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Period</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No subscriptions found</td></tr>
            ) : (
              filtered.map((sub: any) => (
                <tr key={sub.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm text-white font-medium">{sub.tenant_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{sub.plan_type}</td>
                  <td className="px-4 py-3">
                    <select
                      value={sub.payment_status}
                      onChange={(e) => updateStatusMutation.mutate({ id: sub.id, status: e.target.value })}
                      className={`text-xs font-medium rounded px-2 py-0.5 bg-transparent border-0 cursor-pointer ${
                        sub.payment_status === 'active' ? 'text-emerald-400' :
                        sub.payment_status === 'pending' ? 'text-amber-400' : 'text-red-400'
                      }`}
                    >
                      <option value="active">active</option>
                      <option value="pending">pending</option>
                      <option value="expired">expired</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">₹{(sub.total_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {sub.start_date ? format(new Date(sub.start_date), "MMM d") : "—"} – {sub.end_date ? format(new Date(sub.end_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-300" onClick={() => extendMutation.mutate({ id: sub.id, days: 30 })}>
                      +30d
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create subscription dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>Create Subscription</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Tenant</Label>
              <select value={form.tenant_id} onChange={(e) => setForm(f => ({ ...f, tenant_id: e.target.value }))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                <option value="">Select tenant...</option>
                {allTenants.map((t: any) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Plan Type</Label>
              <select value={form.plan_type} onChange={(e) => setForm(f => ({ ...f, plan_type: e.target.value }))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                <option value="monthly">Monthly (₹1,500/user)</option>
                <option value="half_yearly">Half-Yearly (₹1,200/user)</option>
                <option value="annual">Annual (₹750/user)</option>
              </select>
            </div>
            <div><Label className="text-zinc-300">Number of Users</Label><Input type="number" value={form.num_users} onChange={e => setForm(f => ({...f, num_users: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-zinc-300">Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><Label className="text-zinc-300">End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!form.tenant_id || createMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Payment Link dialog */}
      <Dialog open={paymentLinkOpen} onOpenChange={setPaymentLinkOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>Generate Payment Link</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Tenant</Label>
              <select value={linkForm.tenant_id} onChange={(e) => setLinkForm(f => ({ ...f, tenant_id: e.target.value }))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                <option value="">Select tenant...</option>
                {allTenants.map((t: any) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Plan Type</Label>
              <select value={linkForm.plan_type} onChange={(e) => setLinkForm(f => ({ ...f, plan_type: e.target.value }))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                <option value="monthly">Monthly (₹1,500/user/mo)</option>
                <option value="half_yearly">Half-Yearly (₹1,200/user/mo)</option>
                <option value="annual">Annual (₹750/user/mo)</option>
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Number of Users</Label>
              <Input type="number" min="1" value={linkForm.num_users} onChange={e => setLinkForm(f => ({...f, num_users: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>

            {generatedLink && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                <Label className="text-zinc-400 text-xs mb-2 block">Shareable Payment Link</Label>
                <div className="flex items-center gap-2">
                  <Input value={generatedLink} readOnly className="bg-zinc-900 border-zinc-700 text-emerald-400 text-xs flex-1" />
                  <Button size="sm" variant="outline" className="border-zinc-700 shrink-0" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                  </Button>
                </div>
                <p className="text-zinc-500 text-xs mt-2">Share this link with the customer to collect payment</p>
              </div>
            )}

            <Button
              onClick={() => generateLinkMutation.mutate()}
              disabled={!linkForm.tenant_id || generateLinkMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {generateLinkMutation.isPending ? "Generating..." : "Generate Payment Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
