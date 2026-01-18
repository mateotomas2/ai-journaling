import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '@/pages/SettingsPage';
import * as settingsService from '@/services/settings/settings.service';

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
}));

describe('Settings Page - Model Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock returns
    vi.mocked(settingsService.getApiKey).mockResolvedValue('sk-test-key');
    vi.mocked(settingsService.getSystemPrompt).mockResolvedValue('Default prompt');
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('openai/gpt-4o');
  });

  it('should display model selector', async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const modelSelector = screen.getByLabelText(/ai model/i);
      expect(modelSelector).toBeInTheDocument();
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
      const select = screen.getByRole('combobox', { name: /ai model/i }) as HTMLSelectElement;
      expect(select.value).toBe('google/gemini-2.5-flash');
    });
  });

  it('should save model selection on change', async () => {
    vi.mocked(settingsService.updateSummarizerModel).mockResolvedValue();

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /ai model/i });
      expect(select).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /ai model/i });
    fireEvent.change(select, { target: { value: 'anthropic/claude-sonnet-4.5' } });

    await waitFor(() => {
      expect(settingsService.updateSummarizerModel).toHaveBeenCalledWith(
        expect.anything(),
        'anthropic/claude-sonnet-4.5'
      );
    });
  });

  it('should persist model selection across page refreshes', async () => {
    // First render - change model
    vi.mocked(settingsService.getSummarizerModel).mockResolvedValue('openai/gpt-4o');
    vi.mocked(settingsService.updateSummarizerModel).mockResolvedValue();

    const { unmount } = render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /ai model/i });
      expect(select).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /ai model/i });
    fireEvent.change(select, { target: { value: 'openai/gpt-4o-mini' } });

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
      const selectAfterRefresh = screen.getByRole('combobox', {
        name: /ai model/i,
      }) as HTMLSelectElement;
      expect(selectAfterRefresh.value).toBe('openai/gpt-4o-mini');
    });
  });
});
