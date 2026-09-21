import { useState, useEffect, useCallback } from 'react';
import { durableMutationManager, QueueStats } from '../services/durableMutationManager';

export type NetworkHealthState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';

export interface NetworkStatus {
  state: NetworkHealthState;
  isOnline: boolean;
  isOffline: boolean;
  isDegraded: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  effectiveType?: string;
  rtt?: number;
  forceSyncNow: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [queueStats, setQueueStats] = useState<QueueStats>({
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    isOnline: true,
  });

  const [isDegraded, setIsDegraded] = useState<boolean>(false);
  const [connectionInfo, setConnectionInfo] = useState<{ effectiveType?: string; rtt?: number }>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API inspection (if supported by Chromium/Android)
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      const updateConn = () => {
        const eff = conn.effectiveType;
        const rtt = conn.rtt;
        setConnectionInfo({ effectiveType: eff, rtt });
        setIsDegraded(eff === 'slow-2g' || eff === '2g' || (rtt && rtt > 1500));
      };
      updateConn();
      conn.addEventListener('change', updateConn);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        conn.removeEventListener('change', updateConn);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to Durable Mutation Queue
  useEffect(() => {
    const unsubscribe = durableMutationManager.subscribe((stats) => {
      setQueueStats(stats);
    });
    return unsubscribe;
  }, []);

  const forceSyncNow = useCallback(async () => {
    await durableMutationManager.processQueue();
  }, []);

  // Compute composite state
  let state: NetworkHealthState = 'ONLINE';
  if (!isBrowserOnline) {
    state = 'OFFLINE';
  } else if (queueStats.syncingCount > 0) {
    state = 'SYNCING';
  } else if (isDegraded) {
    state = 'DEGRADED';
  }

  return {
    state,
    isOnline: isBrowserOnline,
    isOffline: !isBrowserOnline,
    isDegraded,
    isSyncing: queueStats.syncingCount > 0,
    pendingCount: queueStats.pendingCount,
    syncingCount: queueStats.syncingCount,
    syncedCount: queueStats.syncedCount,
    effectiveType: connectionInfo.effectiveType,
    rtt: connectionInfo.rtt,
    forceSyncNow,
  };
}
