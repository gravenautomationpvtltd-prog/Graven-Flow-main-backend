import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateDashboardData } from '@/lib/dashboard-invalidation';

/**
 * Global Realtime subscription for leads & customer ingestion:
 * When a lead is inserted (TradeIndia, IndiaMART, webhook, email, manual)
 * or updated in the database, Supabase Realtime instantly invalidates
 * the leads query cache and dashboard metrics, triggering an immediate
 * UI update on OneDesk dashboards without waiting for polling.
 */
export function useLeadsRealtime() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleLeadChange = (payload: any) => {
      // 400ms debounce to collapse rapid consecutive inserts/updates into a single smooth re-fetch
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['leads'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['lqt-leads'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['lqt-stats'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['lead'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        queryClient.invalidateQueries({ queryKey: ['quotation'] });
        queryClient.invalidateQueries({ queryKey: ['user-quotations'] });
        queryClient.invalidateQueries({ queryKey: ['user-quotation-performance'] });
        queryClient.invalidateQueries({ queryKey: ['spt-inbox'], type: 'active' });
        invalidateDashboardData(queryClient);
      }, 400);
    };

    const channel = supabase
      .channel('leads-global-live-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, handleLeadChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, handleLeadChange)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, handleLeadChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, handleLeadChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, handleLeadChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_qualification' }, handleLeadChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // eslint-disable-next-line no-console
          console.debug('[Realtime] 🟢 Leads & quotations realtime channel subscribed');
        }
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
