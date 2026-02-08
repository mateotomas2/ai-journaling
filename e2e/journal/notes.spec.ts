import { test } from '@playwright/test';

test.describe('Notes CRUD', () => {
  test.todo('create a note with title, content, and category');
  test.todo('edit a note and verify auto-save after debounce');
  test.todo('delete a note with confirmation');
  test.todo('display correct category badges for different note types');
});

test.describe('Regenerate notes', () => {
  test.todo('regenerate notes from chat messages and preview in modal');
  test.todo('select individual regenerated notes to save');
  test.todo('preserve existing notes after regeneration');
});
