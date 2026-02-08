import { test } from '@playwright/test';

test.describe('Encryption at rest', () => {
  test.todo('message content is encrypted in IndexedDB and not readable as plaintext');
  test.todo('note content, title, and category are encrypted in IndexedDB');
  test.todo('summary sections and rawContent are encrypted in IndexedDB');
  test.todo('embedding vectors are encrypted in IndexedDB');
});

test.describe('No data leakage', () => {
  test.todo('no journal content appears in localStorage');
  test.todo('no journal content appears in sessionStorage');
  test.todo('no sensitive data in service worker cache (API keys, messages, notes)');
  test.todo('page title and URL do not reveal journal content');
});

test.describe('API key protection', () => {
  test.todo('API key is not visible in the DOM when not in edit mode');
  test.todo('API key is not sent to any endpoint other than OpenRouter');
  test.todo('API key is not stored in plaintext in IndexedDB or localStorage');
});

test.describe('Authentication boundary', () => {
  test.todo('journal page is not accessible without unlocking with password');
  test.todo('navigating directly to /journal/:date without auth redirects to unlock');
  test.todo('navigating directly to /settings without auth redirects to unlock');
  test.todo('navigating directly to /history without auth redirects to unlock');
  test.todo('database is not queryable from devtools without the correct password');
});

test.describe('Session security', () => {
  test.todo('closing the browser tab clears in-memory decryption key');
  test.todo('no sensitive data persists in browser history state');
});

test.describe('Data export safety', () => {
  test.todo('exported JSON does not contain the API key');
  test.todo('exported JSON contains encrypted fields, not plaintext');
});

test.describe('Network privacy', () => {
  test.todo('no outbound requests are made before user sets an API key');
  test.todo('chat messages are only sent to the configured OpenRouter endpoint');
  test.todo('no analytics or tracking requests are made');
});
