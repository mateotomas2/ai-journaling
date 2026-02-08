import { useState } from 'react';
import { useGoogleDriveSync } from '@/hooks/useGoogleDriveSync';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, LogIn } from 'lucide-react';

export function GoogleDriveSync() {
  const {
    isConnected,
    isSyncing,
    lastSyncTime,
    syncError,
    needsReauth,
    connect,
    disconnect,
    syncNow,
  } = useGoogleDriveSync();
  const { showToast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
      showToast('Google Drive connected — syncing data', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      showToast(`Connection failed: ${message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    showToast('Google Drive disconnected', 'info');
  };

  const handleSyncNow = async () => {
    try {
      await syncNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      showToast(`Sync failed: ${message}`, 'error');
    }
  };

  const handleReauth = async () => {
    setIsConnecting(true);
    try {
      await connect();
      showToast('Re-authenticated successfully', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to re-authenticate';
      showToast(`Re-authentication failed: ${message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const formatSyncTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Google Drive Sync
        </CardTitle>
        <CardDescription>
          Automatically sync your encrypted journal data to Google Drive across devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your Google account to enable automatic encrypted backup and cross-device sync.
              Your data is encrypted before leaving this device.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Syncing...</span>
                </>
              ) : syncError ? (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">{syncError}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>
                    {lastSyncTime
                      ? `Last synced ${formatSyncTime(lastSyncTime)}`
                      : 'Connected'}
                  </span>
                </>
              )}
            </div>

            {/* Re-auth prompt */}
            {needsReauth && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  Your Google session has expired. Please re-authenticate to continue syncing.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReauth}
                  disabled={isConnecting}
                >
                  <LogIn className="mr-2 h-3 w-3" />
                  {isConnecting ? 'Authenticating...' : 'Re-authenticate'}
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={isSyncing}
              >
                <RefreshCw className={`mr-2 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
              >
                <CloudOff className="mr-2 h-3 w-3" />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
