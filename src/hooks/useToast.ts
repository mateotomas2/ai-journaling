import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export interface UseToastReturn {
  toasts: ToastMessage[];
  showToast: (message: string, type: ToastType) => void;
  hideToast: (id: string) => void;
}

/**
 * Hook for managing toast notifications
 * Auto-dismisses toasts after 4 seconds
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: ToastMessage = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, hideToast };
}
