import { describe, it, expect } from 'vitest';
import { validateApiKey, validateSystemPrompt } from '@/services/settings/validation';

describe('validateApiKey', () => {
  it('should accept valid OpenRouter API key', () => {
    const result = validateApiKey('sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz1234567890');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty API key', () => {
    const result = validateApiKey('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('API key cannot be empty');
  });

  it('should reject whitespace-only API key', () => {
    const result = validateApiKey('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('API key cannot be empty');
  });

  it('should reject API key without correct prefix', () => {
    const result = validateApiKey('invalid-key-1234567890abcdefghijklmnopqrstuvwxyz');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid API key format. OpenRouter keys should start with "sk-or-" or "sk-or-v1-"');
  });

  it('should reject API key that is too short', () => {
    const result = validateApiKey('sk-or-v1-short');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('API key length is invalid');
  });

  it('should reject API key that is too long', () => {
    const longKey = 'sk-or-v1-' + 'a'.repeat(200);
    const result = validateApiKey(longKey);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('API key length is invalid');
  });

  it('should trim whitespace from API key before validation', () => {
    const result = validateApiKey('  sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz1234567890  ');
    expect(result.isValid).toBe(true);
  });
});

describe('validateSystemPrompt', () => {
  it('should accept valid system prompt', () => {
    const result = validateSystemPrompt('You are a helpful assistant.');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty system prompt', () => {
    const result = validateSystemPrompt('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('System prompt cannot be empty');
  });

  it('should reject whitespace-only system prompt', () => {
    const result = validateSystemPrompt('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('System prompt cannot be empty');
  });

  it('should reject system prompt exceeding 5000 characters', () => {
    const longPrompt = 'a'.repeat(5001);
    const result = validateSystemPrompt(longPrompt);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('System prompt is too long');
    expect(result.error).toContain('5001');
  });

  it('should accept system prompt at exactly 5000 characters', () => {
    const maxPrompt = 'a'.repeat(5000);
    const result = validateSystemPrompt(maxPrompt);
    expect(result.isValid).toBe(true);
  });

  it('should trim whitespace from system prompt before validation', () => {
    const result = validateSystemPrompt('  Valid prompt  ');
    expect(result.isValid).toBe(true);
  });
});
