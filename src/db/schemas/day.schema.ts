import type { RxJsonSchema } from 'rxdb';
import type { Day } from '../../types/entities';

export const daySchema: RxJsonSchema<Day> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10, // YYYY-MM-DD
    },
    createdAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 4102444799999, // December 31, 2099
    },
    updatedAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 4102444799999,
    },
    timezone: {
      type: 'string',
      maxLength: 50,
    },
    hasSummary: {
      type: 'boolean',
    },
  },
  required: ['id', 'createdAt', 'updatedAt', 'timezone', 'hasSummary'],
  indexes: ['createdAt', 'hasSummary'],
  additionalProperties: false,
};
