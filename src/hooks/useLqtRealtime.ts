import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes the LQT Inbox to realtime INSERTs / UPDATEs / DELETEs on the
 * tables that drive the inbox so newly ingested external leads (IndiaMART,
 * TradeIndia, webhook, email-inbound, WhatsApp) and qualification changes
 * appear instantly without waiting for staleTime.
 *
 * Uses both invalidateQueries and refetchQueries so cached views with
 * `staleTime: 0` actually re-issue the network request immediately.
 */
export function useLqtRealtime() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = (payload?: any) => {
      if (payload) {
        // Helps debug stale-data issues
        // eslint-disable-next-line no-console
        console.debug('[LQT realtime]', payload.table, payload.eventType);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      // Collapse bulk-import bursts into one refresh. invalidateQueries already
      // refetches active observers, so a second explicit refetch is unnecessary.
      timerRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['lqt-leads'] });
        qc.invalidateQueries({ queryKey: ['lqt-stats'] });
      }, 2_000);
    };

    const channel = supabase
      .channel('lqt-inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_qualification' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lead_qualification' }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lead_qualification' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, refresh)
      .subscribe((status) => {
        // eslint-disable-next-line no-console
        console.debug('[LQT realtime] channel status:', status);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
