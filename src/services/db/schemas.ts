import type { RxJsonSchema } from 'rxdb';
import type { Settings, Day, Message, Summary } from '@/types';

export const settingsSchema: RxJsonSchema<Settings> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10,
    },
    openRouterApiKey: {
      type: 'string',
    },
    systemPrompt: {
      type: 'string',
      maxLength: 5000,
    },
    timezone: {
      type: 'string',
      maxLength: 50,
    },
    setupComplete: {
      type: 'boolean',
    },
    createdAt: {
      type: 'number',
    },
  },
  required: ['id', 'timezone', 'setupComplete', 'createdAt'],
  encrypted: ['openRouterApiKey', 'systemPrompt'],
  additionalProperties: false,
};

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
    },
    updatedAt: {
      type: 'number',
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

export const messageSchema: RxJsonSchema<Message> = {
  version: 0,
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
    timestamp: {
      type: 'number',
    },
    categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['journal', 'insight', 'health', 'dream'],
      },
    },
  },
  required: ['id', 'dayId', 'role', 'content', 'timestamp'],
  indexes: ['dayId', 'timestamp'],
  encrypted: ['content'],
  additionalProperties: false,
};

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
