import { test } from '@playwright/test';

test.describe('Journal chat', () => {
  test.todo('send a message and receive AI streaming response');
  test.todo('chat messages persist across navigation and page reload');
  test.todo('chat with tool calling triggers memory search and incorporates results');
  test.todo('show rate limit warning when sending messages too rapidly');
  test.todo('show empty state placeholder on a new date with no messages');
  test.todo('show error when API key is not configured');
});
