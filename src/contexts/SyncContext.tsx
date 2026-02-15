import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { getSyncEncryptionKey } from '@/db';
import { signIn, signOut } from '@/services/google/auth';
import {
  SyncEngine,
  isSyncEnabled,
  setSyncEnabled,
  type SyncStatus,
} from '@/services/sync/engine';

interface SyncContextValue {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
  needsReauth: boolean;
  syncState: SyncStatus['state'];
  connect: () => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { db } = useDatabase();
  const engineRef = useRef<SyncEngine | null>(null);

  const [isConnected, setIsConnected] = useState(() => isSyncEnabled());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncTime: localStorage.getItem('reflekt_gdrive_last_sync'),
    error: null,
  });

  // Create/destroy engine when db or isConnected changes
  useEffect(() => {
    if (!db || !isConnected) return;

    const engine = new SyncEngine(db, getSyncEncryptionKey);
    engineRef.current = engine;
    console.log('[Sync] SyncEngine initialized');

    const unsubscribe = engine.onStatusChange(setSyncStatus);

    engine.startAutoSync();
    engine.sync();

    return () => {
      engine.stopAutoSync();
      unsubscribe();
      engineRef.current = null;
    };
  }, [db, isConnected]);

  const connect = useCallback(async () => {
    if (!db) throw new Error('Database not available');

    console.log('[Sync] Connecting (signing in to Google Drive)...');
    await signIn();

    setSyncEnabled(true);
    setIsConnected(true);
    console.log('[Sync] Connected');
    // The useEffect above will create the engine and trigger initial sync
  }, [db]);

  const disconnect = useCallback(() => {
    console.log('[Sync] Disconnecting...');
    // Engine cleanup happens via the useEffect when isConnected becomes false
    signOut();
    setSyncEnabled(false);
    setIsConnected(false);
    setSyncStatus({ state: 'idle', lastSyncTime: null, error: null });
  }, []);

  const syncNow = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.sync();
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isConnected,
        isSyncing: syncStatus.state === 'syncing',
        lastSyncTime: syncStatus.lastSyncTime,
        syncError: syncStatus.error,
        needsReauth: syncStatus.state === 'needs-reauth',
        syncState: syncStatus.state,
        connect,
        disconnect,
        syncNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}
