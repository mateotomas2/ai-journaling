import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { PromptCustomization } from '@/components/settings/PromptCustomization';
import { DataManagement } from '@/components/settings/DataManagement';

// Mock useSettings hook
const mockSaveApiKey = vi.fn();
const mockUpdateSystemPrompt = vi.fn();
const mockResetSystemPrompt = vi.fn();
const mockUseSettings = vi.fn();

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock useToast hook
const mockShowToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: mockShowToast,
    hideToast: vi.fn(),
  }),
}));

describe('ApiKeySection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({
      apiKey: 'sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz',
      isLoading: false,
      saveApiKey: mockSaveApiKey,
    });
  });

  describe('Display and Masking', () => {
    it('should display masked API key showing only last 4 characters', () => {
      render(<ApiKeySection />);

      const input = screen.getByRole('textbox', { name: /api key/i });
      expect(input).toHaveValue('sk-or-v1-***wxyz');
    });

    it('should show full API key when edit mode is enabled', async () => {
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      expect(input).toHaveValue('sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should handle missing API key gracefully', () => {
      mockUseSettings.mockReturnValue({
        apiKey: null,
        isLoading: false,
        saveApiKey: mockSaveApiKey,
      });

      render(<ApiKeySection />);

      const input = screen.getByRole('textbox', { name: /api key/i });
      expect(input).toHaveValue('');
    });
  });

  describe('Validation', () => {
    it('should show error for invalid API key format', async () => {
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: 'invalid-key' } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
      });

      expect(mockSaveApiKey).not.toHaveBeenCalled();
    });

    it('should show error for empty API key', async () => {
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: '' } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/api key cannot be empty/i)).toBeInTheDocument();
      });

      expect(mockSaveApiKey).not.toHaveBeenCalled();
    });

    it('should accept valid API key', async () => {
      mockSaveApiKey.mockResolvedValue(undefined);
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      const newKey = 'sk-or-v1-newkey1234567890abcdefghijklmnop';
      fireEvent.change(input, { target: { value: newKey } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveApiKey).toHaveBeenCalledWith(newKey);
      });
    });
  });

  describe('User Interactions', () => {
    it('should enable editing when edit button is clicked', () => {
      render(<ApiKeySection />);

      const input = screen.getByRole('textbox', { name: /api key/i });
      expect(input).toBeDisabled();

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      expect(input).not.toBeDisabled();
    });

    it('should cancel editing and restore original value', () => {
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: 'sk-or-v1-modified' } });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(input).toHaveValue('sk-or-v1-***wxyz');
      expect(input).toBeDisabled();
    });

    it('should show success toast after successful save', async () => {
      mockSaveApiKey.mockResolvedValue(undefined);
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: 'sk-or-v1-newkey1234567890abcdefghijklmnop' } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('API key updated successfully', 'success');
      });
    });

    it('should show error toast on save failure', async () => {
      mockSaveApiKey.mockRejectedValue(new Error('Database error'));
      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: 'sk-or-v1-newkey1234567890abcdefghijklmnop' } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to update API key'),
          'error'
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when settings are loading', () => {
      mockUseSettings.mockReturnValue({
        apiKey: null,
        isLoading: true,
        saveApiKey: mockSaveApiKey,
      });

      render(<ApiKeySection />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should disable save button while saving', async () => {
      let resolveSave: any;
      mockSaveApiKey.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));

      render(<ApiKeySection />);

      const editButton = screen.getByRole('button', { name: /edit api key/i });
      fireEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /api key/i });
      fireEvent.change(input, { target: { value: 'sk-or-v1-newkey1234567890abcdefghijklmnop' } });

      const saveButton = screen.getByRole('button', { name: /save api key/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      resolveSave();
    });
  });
});

describe('PromptCustomization Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({
      systemPrompt: 'You are a helpful journaling assistant.',
      isLoading: false,
      updateSystemPrompt: mockUpdateSystemPrompt,
      resetSystemPrompt: mockResetSystemPrompt,
    });
  });

  describe('Display and Editing', () => {
    it('should display current system prompt', () => {
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      expect(textarea).toHaveValue('You are a helpful journaling assistant.');
    });

    it('should allow editing system prompt', () => {
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'Custom prompt here' } });

      expect(textarea).toHaveValue('Custom prompt here');
    });

    it('should show character count', () => {
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'Short' } });

      expect(screen.getByText(/5 \/ 5000/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error for empty system prompt', async () => {
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: '' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/system prompt cannot be empty/i)).toBeInTheDocument();
      });

      expect(mockUpdateSystemPrompt).not.toHaveBeenCalled();
    });

    it('should show error for system prompt exceeding 5000 characters', async () => {
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      const longPrompt = 'a'.repeat(5001);
      fireEvent.change(textarea, { target: { value: longPrompt } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/system prompt is too long/i)).toBeInTheDocument();
      });

      expect(mockUpdateSystemPrompt).not.toHaveBeenCalled();
    });

    it('should accept valid system prompt', async () => {
      mockUpdateSystemPrompt.mockResolvedValue(undefined);
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      const newPrompt = 'You are a focused productivity assistant.';
      fireEvent.change(textarea, { target: { value: newPrompt } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateSystemPrompt).toHaveBeenCalledWith(newPrompt);
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to default when reset button clicked', async () => {
      mockResetSystemPrompt.mockResolvedValue(undefined);
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'Modified prompt' } });

      const resetButton = screen.getByRole('button', { name: /reset to default/i });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockResetSystemPrompt).toHaveBeenCalled();
      });
    });

    it('should show success toast after reset', async () => {
      mockResetSystemPrompt.mockResolvedValue(undefined);
      render(<PromptCustomization />);

      const resetButton = screen.getByRole('button', { name: /reset to default/i });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('System prompt reset to default', 'success');
      });
    });
  });

  describe('User Interactions', () => {
    it('should show success toast after successful save', async () => {
      mockUpdateSystemPrompt.mockResolvedValue(undefined);
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'Updated prompt' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('System prompt updated successfully', 'success');
      });
    });

    it('should show error toast on save failure', async () => {
      mockUpdateSystemPrompt.mockRejectedValue(new Error('Database error'));
      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'Updated prompt' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to update system prompt'),
          'error'
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when settings are loading', () => {
      mockUseSettings.mockReturnValue({
        systemPrompt: null,
        isLoading: true,
        updateSystemPrompt: mockUpdateSystemPrompt,
        resetSystemPrompt: mockResetSystemPrompt,
      });

      render(<PromptCustomization />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should disable save button while saving', async () => {
      let resolveSave: any;
      mockUpdateSystemPrompt.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));

      render(<PromptCustomization />);

      const textarea = screen.getByRole('textbox', { name: /system prompt/i });
      fireEvent.change(textarea, { target: { value: 'New prompt' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      resolveSave();
    });
  });
});
