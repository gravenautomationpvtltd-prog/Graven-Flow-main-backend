import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type DashboardScopeMode = 'personal' | 'team';

const STORAGE_KEY = 'dashboardScope';

/**
 * Scope toggle for users who can act both as an individual contributor and as a
 * team-lead. Persists per-browser. When mode='personal', callers should filter
 * their queries to the current user; when mode='team', callers use full RLS scope.
 */
export function useDashboardScope() {
  const { user, isSales, isManager, isSalesManager, isAdmin } = useAuth();

  const canToggle = (isManager || isSalesManager || isAdmin) && isSales;
  const lockedTo: DashboardScopeMode | null = canToggle
    ? null
    : isSales
    ? 'personal'
    : 'team';

  const [mode, setModeState] = useState<DashboardScopeMode>(() => {
    if (lockedTo) return lockedTo;
    if (typeof window === 'undefined') return 'team';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Admins (super_admin/COO) don't personally own leads — always default to team
    // and ignore a stale 'personal' preference from a previous session.
    if (isAdmin && stored !== 'team') return 'team';
    if (stored === 'personal' || stored === 'team') return stored;
    return 'team';
  });

  // Re-sync when role flags resolve after first render
  useEffect(() => {
    if (lockedTo && mode !== lockedTo) setModeState(lockedTo);
    else if (isAdmin && mode === 'personal') setModeState('team');
  }, [lockedTo, mode, isAdmin]);

  const setMode = useCallback(
    (next: DashboardScopeMode) => {
      if (lockedTo) return;
      setModeState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [lockedTo]
  );

  const isPersonal = mode === 'personal';

  return {
    mode,
    setMode,
    canToggle,
    isPersonal,
    userId: user?.id,
    /** Pass this straight into hooks that accept an optional `assignedTo`. */
    assignedTo: isPersonal ? user?.id : undefined,
  };
}
