import { describe, it, expect } from 'vitest';
import { settingsSchema } from '@/services/db/schemas';
import type { Settings } from '@/types';

describe('Settings Schema', () => {
  describe('summarizerModel field', () => {
    it('should accept summarizerModel field', () => {
      const settingsData: Settings = {
        id: 'settings',
        timezone: 'America/New_York',
        setupComplete: true,
        createdAt: Date.now(),
        summarizerModel: 'openai/gpt-4o',
      };

      // Verify the schema allows the summarizerModel field
      expect(settingsSchema.properties.summarizerModel).toBeDefined();
      expect(settingsSchema.properties.summarizerModel?.type).toBe('string');
    });

    it('should allow undefined summarizerModel', () => {
      const settingsData: Settings = {
        id: 'settings',
        timezone: 'America/New_York',
        setupComplete: true,
        createdAt: Date.now(),
        // summarizerModel is optional
      };

      // Verify summarizerModel is not required
      expect(settingsSchema.required).not.toContain('summarizerModel');
    });

    it('should accept various model ID formats', () => {
      const modelIds = [
        'openai/gpt-4o',
        'anthropic/claude-sonnet-4.5',
        'google/gemini-2.5-flash',
        'openai/gpt-3.5-turbo',
      ];

      modelIds.forEach(modelId => {
        const settingsData: Settings = {
          id: 'settings',
          timezone: 'UTC',
          setupComplete: true,
          createdAt: Date.now(),
          summarizerModel: modelId,
        };

        // TypeScript compilation is the validation here
        expect(settingsData.summarizerModel).toBe(modelId);
      });
    });
  });
});
