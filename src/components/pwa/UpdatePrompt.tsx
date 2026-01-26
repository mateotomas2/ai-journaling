import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * UpdatePrompt component listens for service worker update events
 * and prompts the user to reload when a new version is available.
 * This is a side-effects only component that returns null.
 */
export function UpdatePrompt() {
  useEffect(() => {
    const handleUpdateAvailable = () => {
      toast('New version available!', {
        description: 'Click reload to update to the latest version',
        action: {
          label: 'Reload',
          onClick: () => {
            // Call the updateSW function stored globally in main.tsx
            const updateSW = (window as any).__updateSW;
            if (updateSW) {
              updateSW(true);
            }
          },
        },
        duration: Infinity, // Keep toast visible until user acts
      });
    };

    const handleOfflineReady = () => {
      toast.success('App ready to work offline!', {
        description: 'All assets cached for offline use',
        duration: 5000,
      });
    };

    // Listen for custom events dispatched in main.tsx
    window.addEventListener('sw-update-available', handleUpdateAvailable);
    window.addEventListener('sw-offline-ready', handleOfflineReady);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      window.removeEventListener('sw-offline-ready', handleOfflineReady);
    };
  }, []);

  return null;
}
