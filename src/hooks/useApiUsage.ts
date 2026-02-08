import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from './useSettings';
import { fetchApiKeyUsage, type ApiKeyUsage } from '@/services/ai/usage.service';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface UseApiUsageReturn {
  usage: ApiKeyUsage | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useApiUsage(): UseApiUsageReturn {
  const { apiKey } = useSettings();
  const [usage, setUsage] = useState<ApiKeyUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUsage = useCallback(async (key: string) => {
    setIsLoading(true);
    const data = await fetchApiKeyUsage(key);
    setUsage(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!apiKey) {
      setUsage(null);
      setIsLoading(false);
      return;
    }

    fetchUsage(apiKey);
    intervalRef.current = setInterval(() => fetchUsage(apiKey), POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [apiKey, fetchUsage]);

  const refetch = useCallback(() => {
    if (apiKey) {
      fetchUsage(apiKey);
    }
  }, [apiKey, fetchUsage]);

  return { usage, isLoading, refetch };
}
