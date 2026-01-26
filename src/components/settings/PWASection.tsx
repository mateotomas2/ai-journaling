import { useState, useEffect } from 'react';
import { Smartphone, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { toast } from 'sonner';

/**
 * PWASection component provides PWA-related settings and information.
 * Shows installation status, install button, cache management, and offline features.
 */
export function PWASection() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  useEffect(() => {
    // Check if app is installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Estimate cache size
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        const usageInMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        setCacheSize(usageInMB);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClearCache = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }

      toast.success('Cache cleared successfully', {
        description: 'Reload the page to re-cache assets',
      });

      // Update cache size
      setCacheSize('0.00');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Progressive Web App
        </CardTitle>
        <CardDescription>
          Install this app for offline access and a native app experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Installation Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="font-medium">Installation Status</div>
            <div className="text-sm text-muted-foreground">
              {isInstalled ? 'Installed as app' : 'Running in browser'}
            </div>
          </div>
          <InstallPrompt />
        </div>

        {/* Network Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="font-medium flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-orange-600" />
              )}
              Network Status
            </div>
            <div className="text-sm text-muted-foreground">
              {isOnline ? 'Online' : 'Offline - using cached data'}
            </div>
          </div>
        </div>

        {/* Cache Information */}
        {cacheSize && (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Cache Size</div>
              <div className="text-sm text-muted-foreground">
                {cacheSize} MB stored locally
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cache
            </Button>
          </div>
        )}

        {/* Offline Features Info */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="font-medium text-sm">Offline Features</div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>All journal entries saved locally with RxDB</li>
            <li>AI embeddings and vector search work offline</li>
            <li>ML models cached after first download (~90 MB)</li>
            <li>Full app functionality without internet</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
