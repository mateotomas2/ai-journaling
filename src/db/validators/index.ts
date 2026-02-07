import type { RxJsonSchema, RxDocumentData, RxValidationError } from 'rxdb';
import { wrappedValidateStorageFactory } from 'rxdb';

// Import pre-compiled validators
import {
  validateSettings,
  validateDay,
  validateMessage,
  validateSummary,
  validateNote,
  validateEmbedding,
} from './compiled.js';

/**
 * Creates a fingerprint from a schema based on stable properties.
 * Uses primaryKey + sorted property names for identification.
 */
function getSchemaFingerprint(schema: RxJsonSchema<unknown>): string {
  const primaryKey = typeof schema.primaryKey === 'string'
    ? schema.primaryKey
    : schema.primaryKey?.key ?? '';
  const properties = schema.properties ? Object.keys(schema.properties).sort().join(',') : '';
  return `${primaryKey}:${properties}`;
}

// Build lookup map using schema fingerprints for robust matching
const validatorMap: Record<string, typeof validateSettings> = {
  // settings: id + openRouterApiKey,systemPrompt,summarizerModel,chatModel,timezone,setupComplete,createdAt
  'id:chatModel,createdAt,id,openRouterApiKey,setupComplete,summarizerModel,systemPrompt,timezone': validateSettings,
  // days: id + createdAt,updatedAt,timezone,hasSummary
  'id:createdAt,hasSummary,id,timezone,updatedAt': validateDay,
  // messages: id + dayId,role,content,timestamp,categories
  'id:categories,content,dayId,id,role,timestamp': validateMessage,
  // summaries: id + dayId,generatedAt,sections,rawContent
  'id:dayId,generatedAt,id,rawContent,sections': validateSummary,
  // notes: id + dayId,category,title,content,createdAt,updatedAt
  'id:category,content,createdAt,dayId,id,title,updatedAt': validateNote,
  // embeddings: id + messageId,vector,modelVersion,createdAt
  'id:createdAt,id,messageId,modelVersion,vector': validateEmbedding,
};

/**
 * Get a pre-compiled validator for the given schema.
 * Looks up the validator by schema fingerprint (primaryKey + property names).
 */
function getValidator(schema: RxJsonSchema<unknown>) {
  const fingerprint = getSchemaFingerprint(schema);
  const validator = validatorMap[fingerprint];

  if (!validator) {
    // Unknown schema (likely RxDB internal) - skip validation
    // Return a no-op validator that always passes
    return (_docData: RxDocumentData<unknown>): RxValidationError[] => [];
  }

  return (docData: RxDocumentData<unknown>): RxValidationError[] => {
    const isValid = validator(docData);
    if (isValid) return [];

    // Convert Ajv errors to RxDB validation errors
    return (validator.errors ?? []).map((err) => ({
      message: err.message ?? 'Validation error',
      schemaPath: err.schemaPath ?? '',
      field: err.instancePath ?? '',
    }));
  };
}

/**
 * Pre-compiled validator storage wrapper.
 * Uses validators generated at build time to avoid runtime eval().
 */
export const wrappedValidatePrecompiledStorage = wrappedValidateStorageFactory(
  getValidator,
  'precompiled'
);
