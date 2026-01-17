/**
 * Validation functions for settings data
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates OpenRouter API key format
 * Basic format check for "sk-or-v1-" prefix
 */
export function validateApiKey(apiKey: string): ValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isValid: false,
      error: 'API key cannot be empty',
    };
  }

  const trimmed = apiKey.trim();

  // Accept both sk-or- and sk-or-v1- prefixes
  if (!trimmed.startsWith('sk-or-v1-') && !trimmed.startsWith('sk-or-')) {
    return {
      isValid: false,
      error: 'Invalid API key format. OpenRouter keys should start with "sk-or-" or "sk-or-v1-"',
    };
  }

  // Reasonable length check (OpenRouter keys are typically 50-100 chars)
  if (trimmed.length < 20 || trimmed.length > 200) {
    return {
      isValid: false,
      error: 'API key length is invalid',
    };
  }

  return { isValid: true };
}

/**
 * Validates system prompt
 * Checks length constraints
 */
export function validateSystemPrompt(prompt: string): ValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return {
      isValid: false,
      error: 'System prompt cannot be empty',
    };
  }

  const trimmed = prompt.trim();

  // Max 5000 characters as per spec
  if (trimmed.length > 5000) {
    return {
      isValid: false,
      error: `System prompt is too long (${trimmed.length} chars). Maximum is 5000 characters.`,
    };
  }

  return { isValid: true };
}
