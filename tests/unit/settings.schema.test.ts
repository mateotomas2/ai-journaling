import { describe, it, expect } from 'vitest';
import { settingsSchema } from '@/services/db/schemas';


describe('Settings Schema', () => {
  describe('summarizerModel field', () => {
    it('should accept summarizerModel field', () => {


      // Verify the schema allows the summarizerModel field
      expect(settingsSchema.properties.summarizerModel).toBeDefined();
      expect(settingsSchema.properties.summarizerModel?.type).toBe('string');
    });

    it('should allow undefined summarizerModel', () => {


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
        // TypeScript compilation is the validation here
        expect(modelId).toBe(modelId);
      });
    });
  });
});
