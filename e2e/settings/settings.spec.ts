import { test } from '@playwright/test';

test.describe('API key', () => {
  test.todo('save API key and verify it persists after reload');
  test.todo('mask API key in the UI when not editing');
});

test.describe('Model selection', () => {
  test.todo('change chat model and verify selection persists');
  test.todo('change summarizer model and verify selection persists');
});

test.describe('System prompt', () => {
  test.todo('edit system prompt and verify it persists');
});

test.describe('Security', () => {
  test.todo('change password and unlock with new password');
});

test.describe('Data management', () => {
  test.todo('export data as JSON file');
  test.todo('import data from backup and verify restoration');
  test.todo('clear all data with confirmation and verify empty state');
});
