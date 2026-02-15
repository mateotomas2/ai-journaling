import { RefreshCw, Cloud, CloudOff, AlertCircle } from 'lucide-react';
import { useGoogleDriveSync } from '@/hooks/useGoogleDriveSync';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatusIndicator() {
  const { isConnected, syncState, lastSyncTime, syncError, syncNow } = useGoogleDriveSync();

  if (!isConnected) return null;

  let icon: React.ReactNode;
  let tooltip: string;

  switch (syncState) {
    case 'syncing':
      icon = <RefreshCw className="w-4 h-4 animate-spin" />;
      tooltip = 'Syncing...';
      break;
    case 'error':
      icon = <CloudOff className="w-4 h-4 text-destructive" />;
      tooltip = syncError ?? 'Sync error';
      break;
    case 'needs-reauth':
      icon = <AlertCircle className="w-4 h-4 text-warning" />;
      tooltip = 'Re-authentication needed';
      break;
    default:
      icon = <Cloud className="w-4 h-4" />;
      tooltip = lastSyncTime
        ? `Synced · ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`
        : 'Connected';
      break;
  }

  return (
    <button
      onClick={syncNow}
      className="flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
      title={tooltip}
    >
      {icon}
    </button>
  );
}
