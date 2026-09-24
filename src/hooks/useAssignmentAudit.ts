import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface UnloggedLead {
  lead_id: string;
  title: string | null;
  source: string | null;
  created_at: string;
  assigned_to: string | null;
  assignee_name: string | null;
  customer_id: string | null;
  company_name: string | null;
}

export interface AuditSettings {
  id?: string;
  tenant_id: string;
  alert_threshold: number;
  alert_emails: string[];
  alert_throttle_hours: number;
}

export interface AuditRun {
  id: string;
  ran_at: string;
  unlogged_count: number;
  threshold: number;
  alert_sent: boolean;
  alert_error: string | null;
}

export function useUnloggedLeads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unlogged-leads-24h"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unlogged_leads_last_24h");
      if (error) throw error;
      return (data ?? []) as UnloggedLead[];
    },
  });
}

export function useAuditSettings(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["assignment-audit-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_audit_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as AuditSettings | null;
    },
  });
}

export function useSaveAuditSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AuditSettings) => {
      const { error } = await supabase
        .from("assignment_audit_settings")
        .upsert(
          {
            tenant_id: input.tenant_id,
            alert_threshold: input.alert_threshold,
            alert_emails: input.alert_emails,
            alert_throttle_hours: input.alert_throttle_hours,
          },
          { onConflict: "tenant_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-audit-settings"] });
      toast.success("Audit settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAuditRuns(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["assignment-audit-runs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_audit_runs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("ran_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AuditRun[];
    },
  });
}
