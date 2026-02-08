import { test } from '@playwright/test';

test.describe('First-time setup', () => {
  test.todo('create password, skip biometric, land on journal page');
  test.todo('create password, enable biometric, verify both unlock methods work');
  test.todo('reject weak passwords with validation error');
  test.todo('show "No Password Recovery" warning before finalizing');
});

test.describe('Unlock', () => {
  test.todo('unlock with correct password and access data');
  test.todo('reject incorrect password with error message');
  test.todo('unlock with biometric when enabled');
});

test.describe('Forgot password', () => {
  test.todo('navigate to forgot password and see data-loss warning');
});
