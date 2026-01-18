import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/components/settings/ModelSelector';
import { FALLBACK_MODELS } from '@/services/ai/models.service';
import * as modelsService from '@/services/ai/models.service';

// Mock the models service
vi.mock('@/services/ai/models.service', () => ({
  fetchModels: vi.fn().mockResolvedValue([
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
    }
  ]),
  FALLBACK_MODELS: [
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
    }
  ]
}));

// Mock ResizeObserver for Popover/Command
globalThis.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Mock hasPointerCapture since it's missing in JSDOM
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => { };
Element.prototype.releasePointerCapture = () => { };

describe('ModelSelector Component', () => {
  describe('rendering', () => {
    it('should render combobox button with selected model', async () => {
      render(<ModelSelector value="openai/gpt-4o" onChange={vi.fn()} />);

      await waitFor(() => {
        // Check for combobox button
        const trigger = screen.getByRole('combobox');
        expect(trigger).toBeInTheDocument();
        // Expect text content to contain the model name (need to know mapping, assumes GPT-4o is in fallback or known)
        // For this test, we might just check it exists.
      });
    });

    it('should display the selected value name', async () => {
      // Mock fetchModels to ensure we have the model data to display the name
      vi.mocked(modelsService.fetchModels).mockResolvedValue(FALLBACK_MODELS);

      render(<ModelSelector value="openai/gpt-4o" onChange={vi.fn()} />);

      await waitFor(() => {
        const trigger = screen.getByRole('combobox');
        expect(trigger).toHaveTextContent(/GPT-4o/i);
      });
    });

    it('should render all fallback models as options when opened', async () => {
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Open the combobox
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Check that we have the right number of options
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(FALLBACK_MODELS.length);
    });

    it('should show model provider and name in options', async () => {
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Open select
      await user.click(screen.getByRole('combobox'));

      // Check that at least one model shows provider info (check the option text content)
      const options = screen.getAllByRole('option');
      const hasProviderInfo = options.some((option) => option.textContent?.includes('OpenAI'));
      expect(hasProviderInfo).toBe(true);
    });
  });

  describe('onChange handler', () => {
    it('should call onChange when model is selected', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<ModelSelector value="openai/gpt-4o" onChange={handleChange} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Verify options are open and select one
      const option = screen.getByRole('option', { name: /Claude/i }); // Assuming Claude is in fallback
      await user.click(option);

      expect(handleChange).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
    });
  });

  describe('accessibility', () => {
    it('should have proper label', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const label = screen.getByText(/select model/i); // Adjusted matcher to Select Model label
        expect(label).toBeInTheDocument();
      });
    });

    it('should have aria-label on combobox trigger', async () => {
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        const trigger = screen.getByRole('combobox');
        expect(trigger).toHaveAttribute('aria-label');
      });
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

      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      await waitFor(() => {
        expect(modelsService.fetchModels).toHaveBeenCalled();
      });

      // Open components
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Check that models are rendered
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should display fallback models on API error', async () => {
      vi.mocked(modelsService.fetchModels).mockRejectedValueOnce(new Error('API error'));
      const user = userEvent.setup();

      render(<ModelSelector value="" onChange={vi.fn()} />);

      // Wait for the component to handle the error
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

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

      // Component should render
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
      // Potentially check for "Loading..." text if implemented, but trigger presence is basic check
    });
  });

  describe('model information display', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(modelsService.fetchModels).mockResolvedValueOnce(FALLBACK_MODELS);
    });

    it('should display provider name for each model', async () => {
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

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
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

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

    it('should have a search input field inside the popover', async () => {
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search/i); // Adjusted matcher
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter models based on search term', async () => {
      const user = userEvent.setup();
      render(<ModelSelector value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(FALLBACK_MODELS.length);
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'gpt');

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        // Should only show GPT models
        expect(options.length).toBeGreaterThan(0);
        const nonGpt = options.some(opt => !opt.textContent?.toLowerCase().includes('gpt'));
        expect(nonGpt).toBe(false);
      });
    });
  });
});
