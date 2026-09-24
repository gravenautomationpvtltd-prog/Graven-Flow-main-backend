import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';

export interface Vertical {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  doc_prefix: string;
  logo_url: string | null;
  letterhead_url: string | null;
  gst_number: string | null;
  currency: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface VerticalContextValue {
  verticals: Vertical[];
  activeVertical: Vertical | null;
  activeVerticalId: string | null;
  loading: boolean;
  switchVertical: (id: string) => void;
  refresh: () => Promise<void>;
}

const VerticalContext = createContext<VerticalContextValue | undefined>(undefined);

const STORAGE_KEY = 'graven.activeVerticalId';

export function VerticalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tenant, tenantRole } = useTenantStatus();
  const qc = useQueryClient();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [activeVerticalId, setActiveVerticalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !tenant) {
      setVerticals([]);
      setActiveVerticalId(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    let allowedIds: Set<string> | null = null;
    if (tenantRole !== 'owner' && tenantRole !== 'admin') {
      const { data: vu } = await supabase
        .from('vertical_users' as any)
        .select('vertical_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      allowedIds = new Set((vu ?? []).map((r: any) => r.vertical_id));
    }

    const { data, error } = await supabase
      .from('verticals' as any)
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('verticals load error', error);
      setVerticals([]);
      setLoading(false);
      return;
    }

    const list = ((data ?? []) as unknown as Vertical[]).filter(
      (v) => !allowedIds || allowedIds.has(v.id)
    );
    setVerticals(list);

    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const fromStored = stored && list.find((v) => v.id === stored);
    const fallback = list.find((v) => v.is_default) ?? list[0] ?? null;
    setActiveVerticalId((fromStored ?? fallback)?.id ?? null);
    setLoading(false);
  }, [user, tenant, tenantRole]);

  useEffect(() => { void load(); }, [load]);

  const switchVertical = useCallback(
    (id: string) => {
      if (!verticals.find((v) => v.id === id)) return;
      setActiveVerticalId(id);
      try { localStorage.setItem(STORAGE_KEY, id); } catch (_) {}
      // Invalidate everything so vertical-scoped queries refetch.
      qc.invalidateQueries();
    },
    [verticals, qc]
  );

  const value = useMemo<VerticalContextValue>(() => ({
    verticals,
    activeVertical: verticals.find((v) => v.id === activeVerticalId) ?? null,
    activeVerticalId,
    loading,
    switchVertical,
    refresh: load,
  }), [verticals, activeVerticalId, loading, switchVertical, load]);

  return <VerticalContext.Provider value={value}>{children}</VerticalContext.Provider>;
}

export function useVertical(): VerticalContextValue {
  const ctx = useContext(VerticalContext);
  if (!ctx) {
    // Safe fallback when provider not yet mounted (e.g. landing page)
    return {
      verticals: [],
      activeVertical: null,
      activeVerticalId: null,
      loading: false,
      switchVertical: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}

/** Throws if no active vertical — use before any vertical-scoped insert. */
export function requireActiveVerticalId(activeVerticalId: string | null | undefined): string {
  if (!activeVerticalId) {
    throw new Error('NO_VERTICAL: No active business vertical selected. Please pick one from the header.');
  }
  return activeVerticalId;
}
