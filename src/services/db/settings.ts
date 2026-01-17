import { getDatabase } from './database';
import type { Settings } from '@/types';

const SETTINGS_ID = 'settings';

/**
 * Get the settings document
 */
export async function getSettings(): Promise<Settings | null> {
  const db = getDatabase();
  const doc = await db.settings.findOne(SETTINGS_ID).exec();
  return doc ? doc.toJSON() : null;
}

/**
 * Save or update settings
 */
export async function saveSettings(
  settings: Omit<Settings, 'id'>
): Promise<Settings> {
  const db = getDatabase();
  const doc = await db.settings.upsert({
    id: SETTINGS_ID,
    ...settings,
  });
  return doc.toJSON();
}

/**
 * Update specific settings fields
 */
export async function updateSettings(
  updates: Partial<Omit<Settings, 'id'>>
): Promise<Settings | null> {
  const db = getDatabase();
  const doc = await db.settings.findOne(SETTINGS_ID).exec();
  if (!doc) {
    return null;
  }
  await doc.patch(updates);
  return doc.toJSON();
}

/**
 * Get the OpenRouter API key
 */
export async function getApiKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return settings?.openRouterApiKey;
}

/**
 * Save the OpenRouter API key
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  await updateSettings({ openRouterApiKey: apiKey });
}
