import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabase } from './useDatabase';
import { getSyncEncryptionKey } from '@/db';
import { signIn, signOut, isSignedIn } from '@/services/google/auth';
import {
  SyncEngine,
  isSyncEnabled,
  setSyncEnabled,
  type SyncStatus,
} from '@/services/sync/engine';

export function useGoogleDriveSync() {
  const { db } = useDatabase();
  const engineRef = useRef<SyncEngine | null>(null);

  const [isConnected, setIsConnected] = useState(() => isSyncEnabled() && isSignedIn());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncTime: localStorage.getItem('reflekt_gdrive_last_sync'),
    error: null,
  });

  // Initialize engine when db is available and sync is enabled
  useEffect(() => {
    if (!db || !isSyncEnabled()) return;

    const engine = new SyncEngine(db, getSyncEncryptionKey);
    engineRef.current = engine;

    const unsubscribe = engine.onStatusChange(setSyncStatus);

    // Start auto-sync and run initial sync
    engine.startAutoSync();
    engine.sync();

    return () => {
      engine.stopAutoSync();
      unsubscribe();
      engineRef.current = null;
    };
  }, [db]);

  const connect = useCallback(async () => {
    if (!db) throw new Error('Database not available');

    // Sign in with Google
    await signIn();

    // Enable sync
    setSyncEnabled(true);
    setIsConnected(true);

    // Create and start engine
    const engine = new SyncEngine(db, getSyncEncryptionKey);
    engineRef.current = engine;

    const unsubscribe = engine.onStatusChange(setSyncStatus);
    engine.startAutoSync();

    // Run initial sync
    await engine.sync();

    // Return cleanup (stored for disconnect)
    return unsubscribe;
  }, [db]);

  const disconnect = useCallback(() => {
    // Stop auto-sync
    if (engineRef.current) {
      engineRef.current.stopAutoSync();
      engineRef.current = null;
    }

    // Revoke Google token
    signOut();

    // Clear sync config
    setSyncEnabled(false);
    setIsConnected(false);
    setSyncStatus({ state: 'idle', lastSyncTime: null, error: null });
  }, []);

  const syncNow = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.sync();
    }
  }, []);

  return {
    isConnected,
    isSyncing: syncStatus.state === 'syncing',
    lastSyncTime: syncStatus.lastSyncTime,
    syncError: syncStatus.error,
    needsReauth: syncStatus.state === 'needs-reauth',
    syncState: syncStatus.state,
    connect,
    disconnect,
    syncNow,
  };
}
