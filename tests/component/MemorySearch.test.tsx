/**
 * Component tests for MemorySearch
 * Tests search UI, result display, loading states, and user interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemorySearch } from '@/components/search/MemorySearch';
import * as useMemorySearchModule from '@/hooks/useMemorySearch';
import type { MemorySearchResult } from '../../specs/006-vector-memory/contracts/memory-service';
import type { Message } from '@/types/entities';

// Mock the useMemorySearch hook
vi.mock('@/hooks/useMemorySearch', () => ({
  useMemorySearch: vi.fn(),
}));

// Mock date utilities
vi.mock('@/utils/date.utils', () => ({
  formatDayId: (dayId: string) => {
    const date = new Date(dayId);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },
  formatShortDate: (dayId: string) => {
    const date = new Date(dayId);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Mock pointer capture for JSDOM
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => { };
Element.prototype.releasePointerCapture = () => { };

describe('MemorySearch Component', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    dayId: '2026-01-15',
    role: 'user',
    content: 'I had a great day today feeling accomplished and proud of my work.',
    timestamp: Date.now(),
  };

  const mockResults: MemorySearchResult[] = [
    {
      message: mockMessage,
      score: 0.85,
      excerpt: 'I had a great day today feeling accomplished...',
      rank: 1,
    },
  ];

  const defaultHookReturn = {
    query: '',
    results: [],
    isLoading: false,
    error: null,
    hasSearched: false,
    search: vi.fn(),
    clear: vi.fn(),
    setQuery: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue(defaultHookReturn);
  });

  describe('Dialog Behavior', () => {
    it('should render when open is true', () => {
      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText('Search Your Journal')).toBeInTheDocument();
    });

    it('should not render content when open is false', () => {
      render(<MemorySearch open={false} onOpenChange={vi.fn()} />);

      expect(screen.queryByText('Search Your Journal')).not.toBeInTheDocument();
    });

    it('should call onOpenChange when dialog is closed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<MemorySearch open={true} onOpenChange={onOpenChange} />);

      // Find and click the close button (X button in dialog)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Search Input', () => {
    it('should render search input placeholder', () => {
      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(
        screen.getByPlaceholderText(/search for memories/i)
      ).toBeInTheDocument();
    });

    it('should update local query when typing', async () => {
      const user = userEvent.setup();
      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/search for memories/i);
      await user.type(input, 'feeling proud');

      expect(input).toHaveValue('feeling proud');
    });

    it('should call search when Enter is pressed', async () => {
      const user = userEvent.setup();
      const mockSearch = vi.fn();

      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        search: mockSearch,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/search for memories/i);
      await user.type(input, 'feeling proud{Enter}');

      expect(mockSearch).toHaveBeenCalledWith('feeling proud');
    });

    it('should call search when Search button is clicked', async () => {
      const user = userEvent.setup();
      const mockSearch = vi.fn();

      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        search: mockSearch,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/search for memories/i);
      await user.type(input, 'feeling proud');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      expect(mockSearch).toHaveBeenCalledWith('feeling proud');
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when searching', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
        hasSearched: true,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/searching your journal/i)).toBeInTheDocument();
    });

    it('should disable search button when loading', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      const searchButton = screen.getByRole('button', { name: /searching/i });
      expect(searchButton).toBeDisabled();
    });
  });

  describe('Search Results', () => {
    it('should display search results', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        results: mockResults,
        hasSearched: true,
        query: 'feeling proud',
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/1 result found/i)).toBeInTheDocument();
      expect(screen.getByText(/feeling accomplished/i)).toBeInTheDocument();
    });

    it('should show result count', () => {
      const multipleResults = [mockResults[0]!, mockResults[0]!, mockResults[0]!];

      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        results: multipleResults,
        hasSearched: true,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/3 results found/i)).toBeInTheDocument();
    });

    it('should call onResultSelect when a result is clicked', async () => {
      const user = userEvent.setup();
      const onResultSelect = vi.fn();

      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        results: mockResults,
        hasSearched: true,
      });

      render(
        <MemorySearch
          open={true}
          onOpenChange={vi.fn()}
          onResultSelect={onResultSelect}
        />
      );

      const result = screen.getByText(/feeling accomplished/i);
      await user.click(result);

      expect(onResultSelect).toHaveBeenCalledWith('msg-1', '2026-01-15');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when search fails', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        error: new Error('Search failed'),
        hasSearched: true,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/error:/i)).toBeInTheDocument();
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button after search', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        hasSearched: true,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should call clear when clear button is clicked', async () => {
      const user = userEvent.setup();
      const mockClear = vi.fn();

      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        hasSearched: true,
        clear: mockClear,
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('should show empty state before search', () => {
      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(
        screen.getByText(/enter a search query to find relevant journal entries/i)
      ).toBeInTheDocument();
    });

    it('should show no results message when search returns empty', () => {
      vi.mocked(useMemorySearchModule.useMemorySearch).mockReturnValue({
        ...defaultHookReturn,
        results: [],
        hasSearched: true,
        query: 'nonexistent',
      });

      render(<MemorySearch open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/0 results found/i)).toBeInTheDocument();
    });
  });
});
