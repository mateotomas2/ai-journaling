import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendChatMessage, buildChatMessages } from '@/services/ai/chat';
import type { ChatMessage } from '@/types';

const BUILDER_SYSTEM_PROMPT = `You are a prompt engineering assistant helping the user craft a system prompt for their AI journaling companion.

Your job: ask focused questions one at a time to understand their desired tone, style, focus areas, and personality. After each user response, refine the prompt.

Always reply with JSON only — no markdown fences:
{ "message": "<your conversational reply>", "prompt": "<updated full system prompt>" }

IMPORTANT: In the JSON "prompt" field, represent line breaks as \\n (the two-character escape sequence). Never include literal newline characters inside a JSON string value. Preserve all paragraph structure and formatting from any existing prompt provided to you.

Start by greeting the user and asking your first question. If an initial prompt is provided, use it as the starting point.`;

interface DisplayMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface PromptBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (prompt: string) => void;
  initialPrompt?: string;
  title?: string;
  description?: string;
  apiKey: string;
  model?: string;
}

/**
 * Escape literal newlines/tabs inside JSON string values so JSON.parse doesn't choke.
 * Some models emit literal \n characters inside JSON strings (technically invalid).
 */
function sanitizeJsonNewlines(raw: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (escaped) {
      result += ch;
      escaped = false;
    } else if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
    } else if (ch === '"') {
      result += ch;
      inString = !inString;
    } else if (inString && ch === '\n') {
      result += '\\n';
    } else if (inString && ch === '\r') {
      result += '\\r';
    } else if (inString && ch === '\t') {
      result += '\\t';
    } else {
      result += ch;
    }
  }
  return result;
}

function isValidAIResponse(parsed: unknown): parsed is { message: string; prompt: string } {
  return (
    parsed !== null &&
    typeof parsed === 'object' &&
    'message' in parsed &&
    'prompt' in parsed &&
    typeof (parsed as Record<string, unknown>).message === 'string' &&
    typeof (parsed as Record<string, unknown>).prompt === 'string'
  );
}

function parseAIResponse(raw: string): { message: string; prompt: string } | null {
  // First attempt: parse as-is (well-formed JSON)
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isValidAIResponse(parsed)) return parsed;
  } catch {
    // fall through
  }
  // Second attempt: escape literal newlines inside strings first
  try {
    const parsed = JSON.parse(sanitizeJsonNewlines(raw)) as unknown;
    if (isValidAIResponse(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export function PromptBuilderModal({
  isOpen,
  onClose,
  onApply,
  initialPrompt = '',
  title = 'Prompt Builder',
  description,
  apiKey,
  model,
}: PromptBuilderModalProps) {
  const [chatMessages, setChatMessages] = useState<DisplayMessage[]>([]);
  const [apiMessages, setApiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draftPrompt, setDraftPrompt] = useState(initialPrompt);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (isOpen && !initialized.current) {
      initialized.current = true;
      setDraftPrompt(initialPrompt);
      setChatMessages([]);
      setApiMessages([]);
      setInputValue('');
      setError('');
      void sendInitialGreeting(initialPrompt);
    }
    if (!isOpen) {
      initialized.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function sendInitialGreeting(seedPrompt: string) {
    setIsLoading(true);
    setError('');
    try {
      const seedContent = seedPrompt
        ? `The user has an existing prompt to start from:\n\n${seedPrompt}`
        : 'The user has no existing prompt yet — start from scratch.';

      const history: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: seedContent },
      ];
      const messages: ChatMessage[] = buildChatMessages(BUILDER_SYSTEM_PROMPT, history);
      const raw = await sendChatMessage(messages, apiKey, model);
      const parsed = parseAIResponse(raw);

      if (parsed) {
        setChatMessages([{ role: 'assistant', text: parsed.message }]);
        setApiMessages([
          { role: 'user', content: seedContent },
          { role: 'assistant', content: raw },
        ]);
        setDraftPrompt(parsed.prompt);
      } else {
        setChatMessages([{ role: 'assistant', text: raw }]);
        setApiMessages([
          { role: 'user', content: seedContent },
          { role: 'assistant', content: raw },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to AI');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');
    setError('');

    const newDisplay: DisplayMessage = { role: 'user', text };
    const newApiMsg = { role: 'user' as const, content: text };

    setChatMessages((prev) => [...prev, newDisplay]);
    const updatedHistory = [...apiMessages, newApiMsg];
    setApiMessages(updatedHistory);
    setIsLoading(true);

    try {
      const messages: ChatMessage[] = buildChatMessages(BUILDER_SYSTEM_PROMPT, updatedHistory);
      const raw = await sendChatMessage(messages, apiKey, model);
      const parsed = parseAIResponse(raw);

      const assistantApiMsg = { role: 'assistant' as const, content: raw };
      setApiMessages((prev) => [...prev, assistantApiMsg]);

      if (parsed) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: parsed.message }]);
        setDraftPrompt(parsed.prompt);
      } else {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: raw }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleApply() {
    onApply(draftPrompt);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left: Chat */}
          <div className="flex flex-col w-[45%] border-r min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="text-sm text-destructive text-center px-2">{error}</div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t shrink-0">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response... (Enter to send)"
                className="min-h-[72px] resize-none text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Right: Prompt preview */}
          <div className="flex flex-col w-[55%] min-h-0">
            <div className="px-4 py-2 border-b shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Live Prompt Preview
              </p>
            </div>
            <Textarea
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              className="flex-1 resize-none rounded-none border-0 focus-visible:ring-0 text-sm font-mono"
              placeholder="Your prompt will appear here as you chat..."
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!draftPrompt.trim()}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
