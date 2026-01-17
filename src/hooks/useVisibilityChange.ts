import { useEffect, useCallback, useRef } from 'react';

interface UseVisibilityChangeOptions {
  onVisible?: () => void;
  onHidden?: () => void;
}

/**
 * Hook to handle document visibility changes
 * Useful for triggering actions when user returns to the app
 */
export function useVisibilityChange(options: UseVisibilityChangeOptions = {}) {
  const { onVisible, onHidden } = options;
  const lastVisibilityRef = useRef(document.visibilityState);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    const wasVisible = lastVisibilityRef.current === 'visible';

    if (isVisible && !wasVisible && onVisible) {
      onVisible();
    } else if (!isVisible && wasVisible && onHidden) {
      onHidden();
    }

    lastVisibilityRef.current = document.visibilityState;
  }, [onVisible, onHidden]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);
}
