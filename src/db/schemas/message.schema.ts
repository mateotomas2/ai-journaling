import type { RxJsonSchema } from 'rxdb';
import type { Message } from '../../types/entities';

export const messageSchema: RxJsonSchema<Message> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36, // UUID
    },
    dayId: {
      type: 'string',
      maxLength: 10,
    },
    role: {
      type: 'string',
      enum: ['user', 'assistant'],
    },
    content: {
      type: 'string',
    },
    parts: {
      type: 'string',
    },
    timestamp: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 4102444799999, // December 31, 2099
    },
    deletedAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 4102444799999,
    },
    categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['journal', 'insight', 'health', 'dream'],
      },
    },
  },
  required: ['id', 'dayId', 'role', 'content', 'parts', 'timestamp', 'deletedAt'],
  indexes: ['dayId', 'timestamp', 'deletedAt'],
  encrypted: ['content', 'parts'],
  additionalProperties: false,
};
