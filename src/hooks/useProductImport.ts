import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireTenantId } from '@/utils/tenantUtils';
import type { ActiveImportRow, ImportType } from '@/lib/product-csv';
import { toast } from 'sonner';

export interface ImportRun {
  id: string;
  import_type: string;
  filename: string | null;
  status: string;
  rows_parsed: number;
  rows_new: number;
  rows_updated: number;
  rows_unchanged: number;
  rows_errored: number;
  rows_processed: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useStartProductImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      type,
      filename,
    }: {
      rows: ActiveImportRow[];
      type: ImportType;
      filename: string;
    }) => {
      const tenantId = await requireTenantId();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = rows.map((r) => ({
        brand: r.brand,
        model_no: r.model_no,
        description: r.description,
        list_price: r.list_price,
        sales_discount_pct: r.sales_discount_pct,
        purchase_discount_pct: r.purchase_discount_pct,
        sales_price: r.sales_price,
        purchase_price: r.purchase_price,
        product_status: r.product_status,
        weight_kg: r.weight_kg,
        length_cm: r.length_cm,
        width_cm: r.width_cm,
        height_cm: r.height_cm,
      }));

      const path = `${tenantId}/${Date.now()}-${type}.json`;
      const { error: upErr } = await supabase.storage
        .from('product-imports')
        .upload(path, new Blob([JSON.stringify(payload)], { type: 'application/json' }), { upsert: true });
      if (upErr) throw upErr;

      const { data: run, error: runErr } = await supabase
        .from('product_import_runs')
        .insert({
          tenant_id: tenantId,
          import_type: type,
          filename,
          storage_path: path,
          status: 'processing',
          rows_parsed: payload.length,
          uploaded_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (runErr) throw runErr;

      const { error: fnErr } = await supabase.functions.invoke('import-products-csv', {
        body: {
          run_id: run.id,
          tenant_id: tenantId,
          path,
          source_label: filename,
          uploaded_by: user?.id ?? null,
        },
      });
      if (fnErr) throw fnErr;

      return run.id as string;
    },
    onError: (e: Error) => toast.error(e.message || 'Import could not be started'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
    },
  });
}

/** Polls a single import run while it is still processing. */
export function useImportRun(runId: string | null) {
  return useQuery({
    queryKey: ['product-import-run', runId],
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = (query.state.data as ImportRun | undefined)?.status;
      return status && status !== 'processing' ? false : 1500;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_import_runs')
        .select('*')
        .eq('id', runId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ImportRun;
    },
  });
}

export function useImportRuns(limit = 10) {
  return useQuery({
    queryKey: ['product-import-runs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_import_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as ImportRun[];
    },
  });
}
