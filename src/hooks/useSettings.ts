import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import {
  getApiKey,
  updateApiKey,
  getSystemPrompt,
  updateSystemPrompt,
  resetSystemPrompt,
} from '@/services/settings/settings.service';

interface UseSettingsReturn {
  apiKey: string | null;
  systemPrompt: string | null;
  isLoading: boolean;
  saveApiKey: (key: string) => Promise<void>;
  loadSystemPrompt: () => Promise<string>;
  saveSystemPrompt: (prompt: string) => Promise<void>;
  resetPrompt: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const { db } = useDatabase();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      console.log('[useSettings] Database not initialized');
      setIsLoading(false);
      return;
    }

    // Load initial settings
    const loadSettings = async () => {
      console.log('[useSettings] Loading initial settings...');
      try {
        const [key, prompt] = await Promise.all([
          getApiKey(db),
          getSystemPrompt(db),
        ]);
        console.log('[useSettings] API key loaded:', !!key);
        setApiKey(key || null);
        setSystemPrompt(prompt);
      } catch (err) {
        console.error('[useSettings] Error loading settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Subscribe to settings changes
    console.log('[useSettings] Setting up reactive subscription');
    const subscription = db.settings
      .findOne('settings')
      .$.subscribe(async (settings) => {
        if (settings) {
          console.log('[useSettings] Settings changed, API key:', !!settings.openRouterApiKey);
          setApiKey(settings.openRouterApiKey || null);
          const prompt = await getSystemPrompt(db);
          setSystemPrompt(prompt);
        }
      });

    return () => {
      console.log('[useSettings] Unsubscribing from settings');
      subscription.unsubscribe();
    };
  }, [db]);

  const saveApiKey = useCallback(
    async (key: string) => {
      if (!db) throw new Error('Database not initialized');

      console.log('Saving API key to database...');
      try {
        await updateApiKey(db, key);
        setApiKey(key);
        console.log('API key saved successfully');
      } catch (err) {
        console.error('Failed to save API key:', err);
        throw err;
      }
    },
    [db]
  );

  const loadSystemPrompt = useCallback(async (): Promise<string> => {
    if (!db) throw new Error('Database not initialized');
    const prompt = await getSystemPrompt(db);
    setSystemPrompt(prompt);
    return prompt;
  }, [db]);

  const saveSystemPrompt = useCallback(
    async (prompt: string) => {
      if (!db) throw new Error('Database not initialized');
      await updateSystemPrompt(db, prompt);
      setSystemPrompt(prompt);
    },
    [db]
  );

  const resetPrompt = useCallback(async () => {
    if (!db) throw new Error('Database not initialized');
    await resetSystemPrompt(db);
    const prompt = await getSystemPrompt(db);
    setSystemPrompt(prompt);
  }, [db]);

  return {
    apiKey,
    systemPrompt,
    isLoading,
    saveApiKey,
    loadSystemPrompt,
    saveSystemPrompt,
    resetPrompt,
  };
}
