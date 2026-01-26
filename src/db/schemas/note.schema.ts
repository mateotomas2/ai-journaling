import type { RxJsonSchema } from 'rxdb';
import type { Note } from '../../types/entities';

export const noteSchema: RxJsonSchema<Note> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36, // UUID length
    },
    dayId: {
      type: 'string',
      maxLength: 10, // YYYY-MM-DD format
    },
    category: {
      type: 'string',
      maxLength: 100,
    },
    title: {
      type: 'string',
      maxLength: 500,
    },
    content: {
      type: 'string',
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
      maximum: 4102444799999, // December 31, 2099
    },
  },
  required: ['id', 'dayId', 'category', 'content', 'createdAt', 'updatedAt'],
  indexes: ['dayId', 'category', 'createdAt'],
  encrypted: ['category', 'title', 'content'],
  additionalProperties: false,
};
