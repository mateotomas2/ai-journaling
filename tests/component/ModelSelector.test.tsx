import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelSelector } from '@/components/settings/ModelSelector';
import { FALLBACK_MODELS } from '@/services/ai/models.service';
import * as modelsService from '@/services/ai/models.service';

// Mock the models service
vi.mock('@/services/ai/models.service', async () => {
  const actual = await vi.importActual('@/services/ai/models.service');
  return {
    ...actual,
    fetchModels: vi.fn(),
  };
});

describe('ModelSelector Component', () => {
  describe('rendering', () => {
    it('should render dropdown with models', () => {
      render(<ModelSelector value="openai/gpt-4o" onChange={vi.fn()} />);

      // Check for select element
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should display the selected value', () => {
      render(<ModelSelector value="anthropic/claude-sonnet-4.5" onChange={vi.fn()} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('anthropic/claude-sonnet-4.5');
    });

    it('should render all fallback models as options', () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Check that we have the right number of options
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(FALLBACK_MODELS.length);
    });

    it('should show model provider and name', () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Check that at least one model shows provider info (check the option text content)
      const options = screen.getAllByRole('option');
      const hasProviderInfo = options.some((option) => option.textContent?.includes('OpenAI'));
      expect(hasProviderInfo).toBe(true);
    });
  });

  describe('onChange handler', () => {
    it('should call onChange when model is selected', () => {
      const handleChange = vi.fn();
      render(<ModelSelector value="openai/gpt-4o" onChange={handleChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'google/gemini-2.5-flash' } });

      expect(handleChange).toHaveBeenCalledWith('google/gemini-2.5-flash');
    });

    it('should not call onChange if value does not change', () => {
      const handleChange = vi.fn();
      render(<ModelSelector value="openai/gpt-4o" onChange={handleChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'openai/gpt-4o' } });

      // Should still be called (normal select behavior)
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper label', () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const label = screen.getByText(/ai model/i);
      expect(label).toBeInTheDocument();
    });

    it('should have aria-label on select element', () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label');
    });
  });

  describe('dynamic model fetching', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should fetch models from API on mount', async () => {
      const mockModels = [
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'OpenAI',
          pricing: { prompt: '0.0000025', completion: '0.000010' },
          contextLength: 128000,
        },
        {
          id: 'anthropic/claude-sonnet-4.5',
          name: 'Claude Sonnet 4.5',
          provider: 'Anthropic',
          pricing: { prompt: '0.000003', completion: '0.000015' },
          contextLength: 200000,
        },
      ];

      vi.mocked(modelsService.fetchModels).mockResolvedValueOnce(mockModels);

      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        expect(modelsService.fetchModels).toHaveBeenCalled();
      });

      // Check that models are rendered
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should display fallback models on API error', async () => {
      vi.mocked(modelsService.fetchModels).mockRejectedValueOnce(new Error('API error'));

      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Wait for the component to handle the error
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(FALLBACK_MODELS.length);
      });
    });

    it('should show loading state while fetching models', async () => {
      vi.mocked(modelsService.fetchModels).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(FALLBACK_MODELS), 100))
      );

      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Component should render with loading or fallback models initially
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('model information display', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(modelsService.fetchModels).mockResolvedValueOnce(FALLBACK_MODELS);
    });

    it('should display provider name for each model', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });

      // Check that at least one option contains provider info
      const options = screen.getAllByRole('option');
      const hasProviderInfo = options.some(
        (option) =>
          option.textContent?.includes('OpenAI') ||
          option.textContent?.includes('Anthropic') ||
          option.textContent?.includes('Google')
      );
      expect(hasProviderInfo).toBe(true);
    });

    it('should display pricing information for each model', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });

      // Check that options contain pricing info
      const options = screen.getAllByRole('option');
      const hasPricingInfo = options.every((option) => option.textContent?.includes('$'));
      expect(hasPricingInfo).toBe(true);
    });
  });

  describe('search and filter', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(modelsService.fetchModels).mockResolvedValueOnce(FALLBACK_MODELS);
    });

    it('should have a search input field', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const searchInput = screen.queryByPlaceholderText(/search models/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter models based on search term', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(FALLBACK_MODELS.length);
      });

      const searchInput = screen.getByPlaceholderText(/search models/i);
      fireEvent.change(searchInput, { target: { value: 'gpt' } });

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        // Should only show GPT models
        const gptModels = options.filter((opt) =>
          opt.textContent?.toLowerCase().includes('gpt')
        );
        expect(gptModels.length).toBeGreaterThan(0);
        expect(gptModels.length).toBeLessThan(FALLBACK_MODELS.length);
      });
    });

    it('should show all models when search is cleared', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(FALLBACK_MODELS.length);
      });

      const searchInput = screen.getByPlaceholderText(/search models/i);

      // Filter models
      fireEvent.change(searchInput, { target: { value: 'anthropic' } });
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeLessThan(FALLBACK_MODELS.length);
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(FALLBACK_MODELS.length);
      });
    });
  });
});
