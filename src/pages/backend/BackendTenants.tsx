import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Ban, CheckCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function BackendTenants() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["backend-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "list_tenants" },
      });
      if (error) throw error;
      return data?.tenants || [];
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "update_tenant_status", tenant_id: id, new_status: newStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-tenants"] });
      toast.success("Tenant status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("backend-admin-data", {
        body: { action: "delete_tenant", tenant_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-tenants"] });
      setDeleteTarget(null);
      toast.success("Tenant deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = tenants.filter((t: any) =>
    t.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-zinc-400 text-sm mt-1">{tenants.length} organizations</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Organization</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Users</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Created</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No tenants found</td></tr>
            ) : (
              filtered.map((tenant: any) => {
                const userCount = tenant.user_count || 0;
                const isActive = tenant.subscription_status === 'active' || tenant.subscription_status === 'trial';
                return (
                  <tr key={tenant.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer" onClick={() => navigate(`/backend/tenants/${tenant.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-zinc-400" />
                        </div>
                        <span className="text-white font-medium text-sm">{tenant.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{userCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        tenant.subscription_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        tenant.subscription_status === 'trial' ? 'bg-amber-500/10 text-amber-400' :
                        tenant.subscription_status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                        'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {tenant.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {tenant.created_at ? format(new Date(tenant.created_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => toggleStatusMutation.mutate({ id: tenant.id, newStatus: isActive ? 'cancelled' : 'active' })}>
                          {isActive ? <Ban className="h-3 w-3 text-red-400" /> : <CheckCircle className="h-3 w-3 text-emerald-400" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400"
                          onClick={() => setDeleteTarget(tenant)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete <strong className="text-white">{deleteTarget?.company_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
