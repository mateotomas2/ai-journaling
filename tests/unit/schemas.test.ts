import { describe, it, expect } from 'vitest';
import { daySchema } from '../../src/db/schemas/day.schema';
import { messageSchema } from '../../src/db/schemas/message.schema';
import { summarySchema } from '../../src/db/schemas/summary.schema';

describe('RxDB Schemas', () => {
  describe('daySchema', () => {
    it('has correct primary key', () => {
      expect(daySchema.primaryKey).toBe('id');
    });

    it('has all required fields', () => {
      expect(daySchema.required).toContain('id');
      expect(daySchema.required).toContain('createdAt');
      expect(daySchema.required).toContain('updatedAt');
      expect(daySchema.required).toContain('timezone');
      expect(daySchema.required).toContain('hasSummary');
    });

    it('has indexes', () => {
      expect(daySchema.indexes).toContain('createdAt');
      expect(daySchema.indexes).toContain('hasSummary');
    });
  });

  describe('messageSchema', () => {
    it('has correct primary key', () => {
      expect(messageSchema.primaryKey).toBe('id');
    });

    it('has all required fields', () => {
      expect(messageSchema.required).toContain('id');
      expect(messageSchema.required).toContain('dayId');
      expect(messageSchema.required).toContain('role');
      expect(messageSchema.required).toContain('content');
      expect(messageSchema.required).toContain('timestamp');
    });

    it('has role enum', () => {
      expect(messageSchema.properties.role.enum).toEqual(['user', 'assistant']);
    });

    it('encrypts content field', () => {
      expect(messageSchema.encrypted).toContain('content');
    });
  });

  describe('summarySchema', () => {
    it('has correct primary key', () => {
      expect(summarySchema.primaryKey).toBe('id');
    });

    it('has all required fields', () => {
      expect(summarySchema.required).toContain('id');
      expect(summarySchema.required).toContain('dayId');
      expect(summarySchema.required).toContain('generatedAt');
      expect(summarySchema.required).toContain('sections');
      expect(summarySchema.required).toContain('rawContent');
    });

    it('encrypts sections and rawContent fields', () => {
      expect(summarySchema.encrypted).toContain('sections');
      expect(summarySchema.encrypted).toContain('rawContent');
    });

    it('sections has all required sub-fields', () => {
      const sectionsRequired = summarySchema.properties.sections.required;
      expect(sectionsRequired).toContain('journal');
      expect(sectionsRequired).toContain('insights');
      expect(sectionsRequired).toContain('health');
      expect(sectionsRequired).toContain('dreams');
    });
  });
});
