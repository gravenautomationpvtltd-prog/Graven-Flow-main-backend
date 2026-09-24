import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerOutreachDate {
  customer_id: string;
  last_outreach_date: string;
}

export function useCustomerOutreachDates(customerIds: string[]) {
  return useQuery({
    queryKey: ['customer-outreach-dates', customerIds],
    queryFn: async () => {
      if (!customerIds.length) return new Map<string, string>();

      // Fetch in batches of 100 to avoid query limits
      const batchSize = 100;
      const allResults: CustomerOutreachDate[] = [];

      for (let i = 0; i < customerIds.length; i += batchSize) {
        const batch = customerIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('customer_outreach')
          .select('customer_id, campaign_date')
          .in('customer_id', batch)
          .order('campaign_date', { ascending: false });

        if (error) throw error;
        if (data) {
          // Get the latest date per customer
          const seen = new Set<string>();
          for (const row of data) {
            if (!seen.has(row.customer_id)) {
              seen.add(row.customer_id);
              allResults.push({
                customer_id: row.customer_id,
                last_outreach_date: row.campaign_date,
              });
            }
          }
        }
      }

      const map = new Map<string, string>();
      for (const r of allResults) {
        map.set(r.customer_id, r.last_outreach_date);
      }
      return map;
    },
    enabled: customerIds.length > 0,
    staleTime: 60000,
  });
}

export function getOutreachStatus(lastDate: string | undefined): {
  label: string;
  color: string;
  daysSince: number | null;
} {
  if (!lastDate) {
    return { label: 'Never', color: 'text-muted-foreground', daysSince: null };
  }

  const now = new Date();
  const last = new Date(lastDate);
  const diffMs = now.getTime() - last.getTime();
  const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysSince <= 30) {
    return { label: `${daysSince}d ago`, color: 'text-green-600 dark:text-green-400', daysSince };
  } else if (daysSince <= 90) {
    return { label: `${daysSince}d ago`, color: 'text-amber-600 dark:text-amber-400', daysSince };
  } else {
    return { label: `${daysSince}d ago`, color: 'text-red-600 dark:text-red-400', daysSince };
  }
}
