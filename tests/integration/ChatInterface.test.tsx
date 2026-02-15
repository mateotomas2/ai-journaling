import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../../src/components/chat/MessageInput';
import { MessageList } from '../../src/components/chat/MessageList';
import { MessageBubble } from '../../src/components/chat/MessageBubble';
import type { UIMessage } from '@tanstack/ai';

describe('Chat Components', () => {
  describe('MessageInput', () => {
    it('renders input and send button', () => {
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      expect(screen.getByPlaceholderText(/what's on your mind/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('calls onSend with message content', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      const input = screen.getByPlaceholderText(/what's on your mind/i);
      await user.type(input, 'Hello world');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith('Hello world');
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      const input = screen.getByPlaceholderText(/what's on your mind/i) as HTMLTextAreaElement;
      await user.type(input, 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(input.value).toBe('');
    });

    it('disables send button when input is empty', () => {
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('shows stop button when streaming', () => {
      const onSend = vi.fn();
      const onStop = vi.fn();
      render(<MessageInput onSend={onSend} isStreaming onStop={onStop} />);

      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });
  });

  describe('MessageList', () => {
    it('renders empty state when no messages', () => {
      render(<MessageList messages={[]} />);

      expect(screen.getByText(/welcome to your journal/i)).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<MessageList messages={[]} isLoading />);

      expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
    });

    it('renders messages', () => {
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', content: 'Hello' }],
          createdAt: new Date(),
        },
        {
          id: '2',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Hi there!' }],
          createdAt: new Date(),
        },
      ];

      render(<MessageList messages={messages} />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  describe('MessageBubble', () => {
    const baseMessage: UIMessage = {
      id: '1',
      role: 'user',
      parts: [{ type: 'text', content: 'Test message' }],
      createdAt: new Date(),
    };

    it('renders message content', () => {
      render(<MessageBubble message={baseMessage} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders user message with user icon', () => {
      render(<MessageBubble message={baseMessage} />);

      // User messages render with flex-row-reverse
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders assistant message', () => {
      const assistantMessage: UIMessage = {
        ...baseMessage,
        role: 'assistant',
        parts: [{ type: 'text', content: 'Assistant reply' }],
      };
      render(<MessageBubble message={assistantMessage} />);

      expect(screen.getByText('Assistant reply')).toBeInTheDocument();
    });

    it('shows placeholder for empty content', () => {
      const emptyMessage: UIMessage = {
        ...baseMessage,
        parts: [{ type: 'text', content: '' }],
      };
      render(<MessageBubble message={emptyMessage} />);

      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });
});
