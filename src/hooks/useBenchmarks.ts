import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BenchmarkDirection = 'higher_better' | 'lower_better';

export interface Benchmark {
  id: string;
  department: string;
  office_id: string | null;
  metric: string;
  target_value: number;
  direction: BenchmarkDirection;
  warn_tolerance: number;
  notes: string | null;
  is_active: boolean;
}

export const BENCHMARK_METRICS: Record<
  string,
  { label: string; unit: 'percent' | 'hours' | 'count'; direction: BenchmarkDirection; hint: string }
> = {
  coverage_pct: {
    label: 'Coverage (prices given ÷ requests)',
    unit: 'percent',
    direction: 'higher_better',
    hint: 'Share of raised price requests that received a price',
  },
  tat_compliance_pct: {
    label: 'TAT compliance',
    unit: 'percent',
    direction: 'higher_better',
    hint: 'Requests resolved inside their deadline',
  },
  target_match_pct: {
    label: 'Target-price match rate',
    unit: 'percent',
    direction: 'higher_better',
    hint: 'Requests where the price met the sales target',
  },
  price_gap_pct: {
    label: 'Price gap vs target',
    unit: 'percent',
    direction: 'lower_better',
    hint: 'Average % the quoted price sits above the target rate',
  },
  avg_resolution_hours: {
    label: 'Avg resolution time',
    unit: 'hours',
    direction: 'lower_better',
    hint: 'Hours from request raised to price given',
  },
  no_price_rate_pct: {
    label: 'No-price / regret rate',
    unit: 'percent',
    direction: 'lower_better',
    hint: 'Share of requests closed without a price',
  },
  multi_quote_pct: {
    label: 'Multi-quote discipline',
    unit: 'percent',
    direction: 'higher_better',
    hint: 'Items with 2 or more supplier quotes captured',
  },
  backlog_open: {
    label: 'Open backlog',
    unit: 'count',
    direction: 'lower_better',
    hint: 'Requests still open at the end of the period',
  },
};

export function useOfficesList() {
  return useQuery({
    queryKey: ['offices-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
}

export function useBenchmarks(department = 'procurement') {
  return useQuery({
    queryKey: ['performance-benchmarks', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_benchmarks')
        .select('*')
        .eq('department', department)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as unknown as Benchmark[];
    },
  });
}

export function useUpsertBenchmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: {
      department: string;
      office_id: string | null;
      metric: string;
      target_value: number;
      direction: BenchmarkDirection;
      warn_tolerance: number;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      let q = supabase
        .from('performance_benchmarks')
        .select('id')
        .eq('department', b.department)
        .eq('metric', b.metric);
      q = b.office_id ? q.eq('office_id', b.office_id) : q.is('office_id', null);
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('performance_benchmarks')
          .update({
            target_value: b.target_value,
            direction: b.direction,
            warn_tolerance: b.warn_tolerance,
            notes: b.notes ?? null,
            is_active: true,
          })
          .eq('id', existing.id);
        if (error) throw error;
        return existing.id;
      }

      const { data, error } = await supabase
        .from('performance_benchmarks')
        .insert({ ...b, created_by: user?.id ?? null })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['performance-benchmarks'] });
    },
    onError: (e: Error) => toast.error('Could not save benchmark: ' + e.message),
  });
}

export function useDeleteBenchmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('performance_benchmarks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['performance-benchmarks'] });
      toast.success('Benchmark removed');
    },
    onError: (e: Error) => toast.error('Could not remove benchmark: ' + e.message),
  });
}

/** Pick the region-specific benchmark when present, else the company-wide one. */
export function resolveBenchmark(
  benchmarks: Benchmark[],
  metric: string,
  officeId: string | null,
): Benchmark | undefined {
  return (
    (officeId ? benchmarks.find((b) => b.metric === metric && b.office_id === officeId) : undefined) ??
    benchmarks.find((b) => b.metric === metric && !b.office_id)
  );
}

export function benchmarkStatus(b: Benchmark, actual: number): 'on_track' | 'watch' | 'off_track' {
  const good = b.direction === 'higher_better' ? actual >= b.target_value : actual <= b.target_value;
  if (good) return 'on_track';
  const slack = Math.abs(b.target_value) * (b.warn_tolerance / 100);
  const within =
    b.direction === 'higher_better'
      ? actual >= b.target_value - slack
      : actual <= b.target_value + slack;
  return within ? 'watch' : 'off_track';
}
