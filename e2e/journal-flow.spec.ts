import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the OpenRouter API key from .env file or environment variable.
 */
function getApiKey(): string {
  // First check environment variable
  if (process.env.VITE_OPENROUTER_API_KEY && process.env.VITE_OPENROUTER_API_KEY !== 'sk-or-v1-your-key-here') {
    return process.env.VITE_OPENROUTER_API_KEY;
  }

  // Try reading from .env file
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^VITE_OPENROUTER_API_KEY=(.+)$/m);
    if (match && match[1] && match[1] !== 'sk-or-v1-your-key-here') {
      return match[1].trim();
    }
  } catch {
    // .env file doesn't exist
  }

  return '';
}

const API_KEY = getApiKey();
const TEST_PASSWORD = 'TestPassword123!';
const NOTE_TITLE = 'My pet dragon named Zephyr loves blueberry pancakes';

test.describe('Full journal flow: setup, note, API key, LLM chat', () => {
  test.skip(!API_KEY, 'VITE_OPENROUTER_API_KEY not set — create a .env file with your real OpenRouter key');

  test('create note and retrieve it via LLM chat', async ({ page }) => {
    // --- Step 1: Setup password ---
    await page.goto('/');
    await expect(page.getByText('Welcome to Reflekt')).toBeVisible();

    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Password warning dialog
    await expect(page.getByText('No Password Recovery')).toBeVisible();
    await page.getByRole('button', { name: 'I Understand, Create My Journal' }).click();

    // Wait for embedding service to load (shows "Loading AI models...")
    // This can take 10-60+ seconds on first run
    await expect(page.getByText('Loading AI models...')).toBeVisible({ timeout: 10_000 }).catch(() => {
      // It may have already loaded by the time we check
    });
    await expect(page.getByText('Loading AI models...')).toBeHidden({ timeout: 120_000 });

    // Verify we're on the journal page
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();

    // --- Step 2: Create a note ---
    await page.getByRole('button', { name: '+ Add Note' }).click();

    // Fill the title
    await page.getByPlaceholder('Untitled').fill(NOTE_TITLE);

    // Press Tab to move focus away and trigger save, then wait for auto-save debounce + embedding indexing
    await page.getByPlaceholder('Untitled').press('Tab');
    await page.waitForTimeout(6_000);

    // --- Step 3: Set OpenRouter API key ---
    await page.getByRole('link', { name: 'Settings' }).click();

    // ApiKeySection: click Edit, fill key, click Save
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#api-key-input').fill(API_KEY);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Wait for save confirmation (editing mode closes, Edit button reappears)
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 10_000 });

    // --- Step 4: Chat with LLM and verify note retrieval ---
    await page.getByRole('link', { name: 'Journal', exact: true }).click();

    // Switch to Chat tab
    await page.getByRole('button', { name: 'Chat' }).click();

    // Type a message that should trigger the memory search tool
    const chatInput = page.getByPlaceholder("What's on your mind?");
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill('Do I have any notes about pets or dragons? What do they say exactly?');
    await chatInput.press('Enter');

    // Wait for the assistant response.
    // Assistant messages have flex-row (not flex-row-reverse like user messages)
    // and the bubble has rounded-2xl. The inner text div has the actual content.
    const assistantBubbles = page.locator('.flex-row .whitespace-pre-wrap');

    // Wait for a response that is not the placeholder "..." and has real content
    await expect(async () => {
      const texts = await assistantBubbles.allTextContents();
      const lastText = texts[texts.length - 1] || '';
      expect(lastText).not.toBe('...');
      expect(lastText.length).toBeGreaterThan(10);
    }).toPass({ timeout: 90_000 });

    // Verify the response references our note content
    const allTexts = await assistantBubbles.allTextContents();
    const lastAssistantText = allTexts[allTexts.length - 1]!.toLowerCase();

    const containsNoteReference =
      lastAssistantText.includes('zephyr') ||
      lastAssistantText.includes('dragon') ||
      lastAssistantText.includes('blueberry');

    expect(
      containsNoteReference,
      `Expected LLM response to reference the note content (zephyr/dragon/blueberry). Got: "${allTexts[allTexts.length - 1]}"`,
    ).toBe(true);
  });
});
