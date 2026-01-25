import type { RxJsonSchema } from 'rxdb';
import type { Embedding } from '../../types/entities';

export const embeddingSchema: RxJsonSchema<Embedding> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36, // UUID
    },
    messageId: {
      type: 'string',
      maxLength: 36, // UUID
    },
    vector: {
      type: 'array',
      items: {
        type: 'number',
        minimum: -1,
        maximum: 1,
      },
      minItems: 384,
      maxItems: 384,
    },
    modelVersion: {
      type: 'string',
      pattern: '^[a-zA-Z0-9\\-]+@v\\d+$', // Format: "model-name@version"
      maxLength: 50,
    },
    createdAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 1577836800000, // 2020-01-01
      maximum: 4102444799999, // 2099-12-31
    },
  },
  required: ['id', 'messageId', 'vector', 'modelVersion', 'createdAt'],
  indexes: ['messageId', 'createdAt'],
  encrypted: ['vector'], // Encrypt vectors at rest using existing RxDB encryption
  additionalProperties: false,
};
