import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVertical } from '@/contexts/VerticalContext';
import type { DateRange } from './useDashboardAnalytics';

export type SegmentMetric = 'customers' | 'leads' | 'enquiries' | 'quotations' | 'conversions' | 'revenue' | 'all_qualifiers';

export interface SegmentMetricData {
  segment: string;
  label: string;
  value: number;
  fill: string;
}

const SEGMENT_COLORS: Record<string, string> = {
  platinum: 'hsl(270, 60%, 55%)',
  gold: 'hsl(45, 90%, 50%)',
  silver: 'hsl(220, 10%, 60%)',
  bronze: 'hsl(25, 70%, 55%)',
  inactive: 'hsl(0, 65%, 55%)',
};

const SEGMENT_LABELS: Record<string, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  inactive: 'Inactive',
};

const SEGMENTS = ['platinum', 'gold', 'silver', 'bronze', 'inactive'];

interface UseSegmentAnalyticsOptions {
  dateRange?: DateRange;
  userId?: string;
  isScoped?: boolean;
}

export function useSegmentAnalytics({ dateRange, userId, isScoped }: UseSegmentAnalyticsOptions) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['segment-analytics', activeVerticalId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), userId, isScoped],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_segment_analytics', {
        p_from: dateRange?.from?.toISOString() ?? null,
        p_to: dateRange?.to?.toISOString() ?? null,
        p_user_id: (isScoped && userId) ? userId : null,
        p_is_scoped: !!isScoped,
        p_vertical_id: activeVerticalId ?? null,
      } as any);

      if (error) throw error;

      const result = data as Record<string, Record<string, number>> | null;
      if (!result) return buildEmptyResult();

      const buildMetricData = (metric: string): SegmentMetricData[] => {
        const metricData = result[metric] || {};
        return SEGMENTS.map(seg => ({
          segment: seg,
          label: SEGMENT_LABELS[seg],
          fill: SEGMENT_COLORS[seg],
          value: metricData[seg] ?? 0,
        }));
      };

      return {
        customers: buildMetricData('customers'),
        leads: buildMetricData('leads'),
        enquiries: buildMetricData('enquiries'),
        quotations: buildMetricData('quotations'),
        conversions: buildMetricData('conversions'),
        revenue: buildMetricData('revenue'),
        all_qualifiers: buildMetricData('all_qualifiers'),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

function buildEmptyResult() {
  const empty = SEGMENTS.map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg],
    fill: SEGMENT_COLORS[seg],
    value: 0,
  }));
  return {
    customers: empty,
    leads: [...empty],
    enquiries: [...empty],
    quotations: [...empty],
    conversions: [...empty],
    revenue: [...empty],
    all_qualifiers: [...empty],
  };
}
