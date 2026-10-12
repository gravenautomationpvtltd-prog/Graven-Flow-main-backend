import { useState, useEffect, useCallback } from 'react';
import { syncService, type SyncStatus } from '@/services/syncService';

export function useSyncStatus(): SyncStatus & {
  syncNow: () => Promise<boolean>;
  setAutoSyncEnabled: (enabled: boolean) => void;
  clearLogs: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());

  useEffect(() => {
    const unsubscribe = syncService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const syncNow = useCallback(async () => {
    return await syncService.performSync({ isManual: true });
  }, []);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    syncService.setAutoSyncEnabled(enabled);
  }, []);

  const clearLogs = useCallback(() => {
    syncService.clearLogs();
  }, []);

  return {
    ...status,
    syncNow,
    setAutoSyncEnabled,
    clearLogs,
  };
}
