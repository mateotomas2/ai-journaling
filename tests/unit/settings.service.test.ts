import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getApiKey,
  updateApiKey,
  getSystemPrompt,
  updateSystemPrompt,
  resetSystemPrompt,
  getSummarizerModel,
  updateSummarizerModel,
} from '@/services/settings/settings.service';
import { JOURNAL_SYSTEM_PROMPT } from '@/services/ai/prompts';
import type { JournalDatabase } from '@/db';

// Mock database
const createMockDb = () => {
  const mockSettings = {
    openRouterApiKey: 'sk-or-v1-test-key-1234567890',
    systemPrompt: 'Custom test prompt',
    patch: vi.fn().mockResolvedValue(undefined),
  };

  return {
    settings: {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockSettings),
      }),
    },
  } as unknown as JournalDatabase;
};

describe('Settings Service', () => {
  let mockDb: JournalDatabase;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  describe('getApiKey', () => {
    it('should return API key from settings', async () => {
      const apiKey = await getApiKey(mockDb);
      expect(apiKey).toBe('sk-or-v1-test-key-1234567890');
      expect(mockDb.settings.findOne).toHaveBeenCalledWith('settings');
    });

    it('should return undefined when API key is not set', async () => {
      const mockDbNoKey = createMockDb();
      (mockDbNoKey.settings.findOne('settings').exec as any).mockResolvedValue({
        openRouterApiKey: undefined,
      });

      const apiKey = await getApiKey(mockDbNoKey);
      expect(apiKey).toBeUndefined();
    });
  });

  describe('updateApiKey', () => {
    it('should update API key in settings', async () => {
      const newKey = 'sk-or-v1-new-key-9876543210';
      await updateApiKey(mockDb, newKey);

      const settings = await mockDb.settings.findOne('settings').exec();
      expect(settings?.patch).toHaveBeenCalledWith({ openRouterApiKey: newKey });
    });

    it('should throw error when settings not initialized', async () => {
      const mockDbNoSettings = createMockDb();
      (mockDbNoSettings.settings.findOne('settings').exec as any).mockResolvedValue(null);

      await expect(updateApiKey(mockDbNoSettings, 'sk-or-v1-test')).rejects.toThrow('Settings document not initialized');
    });
  });

  describe('getSystemPrompt', () => {
    it('should return custom system prompt when set', async () => {
      const prompt = await getSystemPrompt(mockDb);
      expect(prompt).toBe('Custom test prompt');
    });

    it('should return default prompt when custom prompt is not set', async () => {
      const mockDbNoPrompt = createMockDb();
      (mockDbNoPrompt.settings.findOne('settings').exec as any).mockResolvedValue({
        systemPrompt: undefined,
      });

      const prompt = await getSystemPrompt(mockDbNoPrompt);
      expect(prompt).toBe(JOURNAL_SYSTEM_PROMPT);
    });

    it('should return default prompt when custom prompt is empty string', async () => {
      const mockDbEmptyPrompt = createMockDb();
      (mockDbEmptyPrompt.settings.findOne('settings').exec as any).mockResolvedValue({
        systemPrompt: '',
      });

      const prompt = await getSystemPrompt(mockDbEmptyPrompt);
      expect(prompt).toBe(JOURNAL_SYSTEM_PROMPT);
    });
  });

  describe('updateSystemPrompt', () => {
    it('should update system prompt in settings', async () => {
      const newPrompt = 'New custom prompt for testing';
      await updateSystemPrompt(mockDb, newPrompt);

      const settings = await mockDb.settings.findOne('settings').exec();
      expect(settings?.patch).toHaveBeenCalledWith({ systemPrompt: newPrompt });
    });

    it('should throw error when settings not initialized', async () => {
      const mockDbNoSettings = createMockDb();
      (mockDbNoSettings.settings.findOne('settings').exec as any).mockResolvedValue(null);

      await expect(updateSystemPrompt(mockDbNoSettings, 'test prompt')).rejects.toThrow('Settings not initialized');
    });
  });

  describe('resetSystemPrompt', () => {
    it('should reset system prompt to default', async () => {
      await resetSystemPrompt(mockDb);

      const settings = await mockDb.settings.findOne('settings').exec();
      expect(settings?.patch).toHaveBeenCalledWith({ systemPrompt: JOURNAL_SYSTEM_PROMPT });
    });

    it('should throw error when settings not initialized', async () => {
      const mockDbNoSettings = createMockDb();
      (mockDbNoSettings.settings.findOne('settings').exec as any).mockResolvedValue(null);

      await expect(resetSystemPrompt(mockDbNoSettings)).rejects.toThrow('Settings not initialized');
    });
  });

  describe('getSummarizerModel', () => {
    it('should return default model when not set', async () => {
      const mockDbNoModel = createMockDb();
      (mockDbNoModel.settings.findOne('settings').exec as any).mockResolvedValue({
        summarizerModel: undefined,
      });

      const model = await getSummarizerModel(mockDbNoModel);
      expect(model).toBe('openai/gpt-4o');
    });

    it('should return custom model when set', async () => {
      const mockDbWithModel = createMockDb();
      (mockDbWithModel.settings.findOne('settings').exec as any).mockResolvedValue({
        summarizerModel: 'anthropic/claude-sonnet-4.5',
      });

      const model = await getSummarizerModel(mockDbWithModel);
      expect(model).toBe('anthropic/claude-sonnet-4.5');
    });

    it('should return default when settings is null', async () => {
      const mockDbNull = createMockDb();
      (mockDbNull.settings.findOne('settings').exec as any).mockResolvedValue(null);

      const model = await getSummarizerModel(mockDbNull);
      expect(model).toBe('openai/gpt-4o');
    });
  });

  describe('updateSummarizerModel', () => {
    it('should persist model selection', async () => {
      const newModel = 'google/gemini-2.5-flash';
      await updateSummarizerModel(mockDb, newModel);

      const settings = await mockDb.settings.findOne('settings').exec();
      expect(settings?.patch).toHaveBeenCalledWith({ summarizerModel: newModel });
    });

    it('should throw error when settings not initialized', async () => {
      const mockDbNoSettings = createMockDb();
      (mockDbNoSettings.settings.findOne('settings').exec as any).mockResolvedValue(null);

      await expect(updateSummarizerModel(mockDbNoSettings, 'openai/gpt-4o')).rejects.toThrow(
        'Settings not initialized'
      );
    });
  });
});
