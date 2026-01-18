/**
 * Settings service for managing user preferences
 */

import type { JournalDatabase } from '@/db';
import { JOURNAL_SYSTEM_PROMPT } from '@/services/ai/prompts';

/**
 * Get the current OpenRouter API key
 */
export async function getApiKey(db: JournalDatabase): Promise<string | undefined> {
  const settings = await db.settings.findOne('settings').exec();
  return settings?.openRouterApiKey;
}

/**
 * Update the OpenRouter API key
 */
export async function updateApiKey(db: JournalDatabase, apiKey: string): Promise<void> {
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) {
    throw new Error('Settings document not initialized. Please refresh the page and try again.');
  }

  try {
    await settings.patch({ openRouterApiKey: apiKey });
  } catch (err) {
    console.error('Database patch failed:', err);
    throw new Error('Failed to save API key to database: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

/**
 * Get the current system prompt (returns default if not set)
 */
export async function getSystemPrompt(db: JournalDatabase): Promise<string> {
  const settings = await db.settings.findOne('settings').exec();
  return settings?.systemPrompt || JOURNAL_SYSTEM_PROMPT;
}

/**
 * Update the system prompt
 */
export async function updateSystemPrompt(db: JournalDatabase, prompt: string): Promise<void> {
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  await settings.patch({ systemPrompt: prompt });
}

/**
 * Reset system prompt to default
 */
export async function resetSystemPrompt(db: JournalDatabase): Promise<void> {
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  await settings.patch({ systemPrompt: JOURNAL_SYSTEM_PROMPT });
}

/**
 * Get the current summarizer model (returns default if not set)
 */
export async function getSummarizerModel(db: JournalDatabase): Promise<string> {
  const settings = await db.settings.findOne('settings').exec();
  return settings?.summarizerModel || 'openai/gpt-4o';
}

/**
 * Update the summarizer model
 */
export async function updateSummarizerModel(db: JournalDatabase, modelId: string): Promise<void> {
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  await settings.patch({ summarizerModel: modelId });
}
