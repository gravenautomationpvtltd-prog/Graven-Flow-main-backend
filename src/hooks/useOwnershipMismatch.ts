import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserTenantId } from "@/utils/tenantUtils";

export interface OwnershipMismatchRow {
  lead_id: string;
  lead_title: string | null;
  lead_status: string;
  lead_source: string | null;
  customer_id: string | null;
  customer_name: string | null;
  owner_id: string;
  owner_name: string | null;
  worker_id: string;
  worker_name: string | null;
  owner_activity_count: number;
  worker_activity_count: number;
  last_activity_at: string | null;
  lead_created_at: string;
}

export interface MismatchFilters {
  days: number;
  minWorkerActions: number;
  requireOwnerZero: boolean;
}

export function useOwnershipMismatches(filters: MismatchFilters) {
  return useQuery({
    queryKey: ["ownership-mismatches", filters],
    queryFn: async () => {
      const tenantId = await getUserTenantId();
      if (!tenantId) return [] as OwnershipMismatchRow[];
      const { data, error } = await supabase.rpc("find_ownership_mismatches" as any, {
        p_tenant: tenantId,
        p_days: filters.days,
        p_min_worker_actions: filters.minWorkerActions,
        p_require_owner_zero: filters.requireOwnerZero,
      });
      if (error) throw error;
      return (data ?? []) as OwnershipMismatchRow[];
    },
  });
}

export function useBulkReassignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ leadId: string; newOwnerId: string }>) => {
      const results = await Promise.allSettled(
        items.map((it) =>
          supabase.from("leads").update({ assigned_to: it.newOwnerId }).eq("id", it.leadId)
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled" && !(r as any).value.error).length;
      const failed = items.length - succeeded;
      return { succeeded, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ownership-mismatches"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
