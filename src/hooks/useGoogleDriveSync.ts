import { useSyncContext } from '@/contexts/SyncContext';

export function useGoogleDriveSync() {
  return useSyncContext();
}
