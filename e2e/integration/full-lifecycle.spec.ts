import { test } from '@playwright/test';

test.describe('Full lifecycle', () => {
  test.todo('setup → chat → create notes → generate summary → search → query history');
  test.todo('data persists across browser sessions (close and reopen)');
});

test.describe('Offline / PWA', () => {
  test.todo('existing data is accessible when offline');
  test.todo('show graceful error for AI features when offline');
});
