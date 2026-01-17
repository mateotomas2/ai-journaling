import type { RxJsonSchema } from 'rxdb';
import type { Summary } from '../../types/entities';

export const summarySchema: RxJsonSchema<Summary> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10,
    },
    dayId: {
      type: 'string',
      maxLength: 10,
    },
    generatedAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 4102444799999, // December 31, 2099
    },
    sections: {
      type: 'object',
      properties: {
        journal: { type: 'string' },
        insights: { type: 'string' },
        health: { type: 'string' },
        dreams: { type: 'string' },
      },
      required: ['journal', 'insights', 'health', 'dreams'],
      additionalProperties: false,
    },
    rawContent: {
      type: 'string',
    },
  },
  required: ['id', 'dayId', 'generatedAt', 'sections', 'rawContent'],
  indexes: ['dayId', 'generatedAt'],
  encrypted: ['sections', 'rawContent'],
  additionalProperties: false,
};
