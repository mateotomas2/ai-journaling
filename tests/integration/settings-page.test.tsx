import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '@/pages/SettingsPage';
import * as settingsService from '@/services/settings/settings.service';
import * as modelsService from '@/services/ai/models.service';

// Mock the database context
const mockDb = {
  settings: {
    findOne: vi.fn(() => ({
      exec: vi.fn().mockResolvedValue({
        openRouterApiKey: 'sk-test-key',
        systemPrompt: 'Test prompt',
        summarizerModel: 'openai/gpt-4o',
      }),
      $: {
        subscribe: vi.fn(() => ({
          unsubscribe: vi.fn(),
        })),
      },
    })),
  },
} as any;

vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: () => ({
    db: mockDb,
  }),
}));

// Mock settings service
vi.mock('@/services/settings/settings.service', () => ({
  getApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  getSystemPrompt: vi.fn(),
  updateSystemPrompt: vi.fn(),
  getSummarizerModel: vi.fn(),
  updateSummarizerModel: vi.fn(),
  getChatModel: vi.fn(),
  updateChatModel: vi.fn(),
}));

// Mock models service
vi.mock('@/services/ai/models.service', () => ({
  fetchModels: vi.fn(),
  FALLBACK_MODELS: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', pricing: { prompt: '0', completion: '0' } },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', pricing: { prompt: '0', completion: '0' } }
  ]
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => { };
Element.prototype.releasePointerCapture = () => { };

describe('Settings Page - Model Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock returns
    vi.mocked(settingsService.getApiKey).mockResolvedValue('sk-test-key');
    vi.mocked(settingsService.getSystemPrompt).mockResolvedValue('Default prompt');
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('openai/gpt-4o');
    vi.mocked(settingsService.getChatModel).mockResolvedValue('openai/gpt-4o');

    // Mock models to return some data
    vi.mocked(modelsService.fetchModels).mockResolvedValue([
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', pricing: { prompt: '0', completion: '0' }, contextLength: 1000 },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', pricing: { prompt: '0', completion: '0' }, contextLength: 1000 },
      { id: 'anthropic/claude-sonnet-4.5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', pricing: { prompt: '0', completion: '0' }, contextLength: 1000 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', pricing: { prompt: '0', completion: '0' }, contextLength: 1000 }
    ]);
  });

  it('should display model selector', async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const modelSelectors = screen.getAllByRole('combobox');
      expect(modelSelectors).toHaveLength(2); // Chat and Summarizer models
    });
  });

  it('should load and display current model selection', async () => {
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('google/gemini-2.5-flash');

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const triggers = screen.getAllByRole('combobox');
      // Find the summarizer model selector (second one)
      const summarizerSelector = triggers[1];
      expect(summarizerSelector).toHaveTextContent(/Gemini/i); // Checking text content, not value
    });
  });

  it('should save model selection on change', async () => {
    vi.mocked(settingsService.updateSummarizerModel).mockResolvedValue();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    const triggers = screen.getAllByRole('combobox');
    const summarizerSelector = triggers[1]!; // Summarizer is second
    await user.click(summarizerSelector);

    // Select an option
    // Assuming 'Claude Sonnet' is available in the fallback list or fetched list
    const option = await screen.findByRole('option', { name: /Claude/i });
    await user.click(option);

    await waitFor(() => {
      expect(settingsService.updateSummarizerModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('anthropic/claude')
      );
    });
  });

  it('should persist model selection across page refreshes', async () => {
    // First render - change model
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('openai/gpt-4o');
    vi.mocked(settingsService.updateSummarizerModel).mockResolvedValue();
    const user = userEvent.setup();

    const { unmount } = render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    // Change model
    const triggers = screen.getAllByRole('combobox');
    const summarizerSelector = triggers[1]!; // Summarizer is second
    await user.click(summarizerSelector);

    // Find a different model
    const option = await screen.findByRole('option', { name: /GPT-4o Mini/i }); // Adjusted to probable name
    await user.click(option);

    await waitFor(() => {
      expect(settingsService.updateSummarizerModel).toHaveBeenCalled();
    });

    // Simulate page refresh
    unmount();

    // Mock returns the updated value
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('openai/gpt-4o-mini');

    // Second render - verify persisted value
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const triggersAfterRefresh = screen.getAllByRole('combobox');
      const summarizerSelectorAfterRefresh = triggersAfterRefresh[1];
      expect(summarizerSelectorAfterRefresh).toHaveTextContent(/Mini/i);
    });
  });
});
