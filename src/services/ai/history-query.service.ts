import type { Summary } from '../../types/entities';
import type { Citation } from '../../types/ai';

interface QueryStreamCallbacks {
  onText: (text: string) => void;
  onComplete: (response: string, citations: Citation[]) => void;
  onError: (error: Error) => void;
}

export async function queryHistory(
  query: string,
  summaries: Summary[],
  dateRange: { start: string; end: string } | undefined,
  callbacks: QueryStreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      summaries: summaries.map((s) => ({
        date: s.dayId,
        rawContent: s.rawContent,
      })),
      dateRange,
    }),
  };

  if (abortSignal) {
    fetchOptions.signal = abortSignal;
  }

  const response = await fetch('/api/query', fetchOptions);

  if (!response.ok) {
    const errorData = await response.json() as { error?: string };
    throw new Error(errorData.error ?? 'Failed to query history');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              response?: string;
              citations?: Citation[];
            };

            if (data.type === 'text_delta' && data.text) {
              fullResponse += data.text;
              callbacks.onText(data.text);
            } else if (data.type === 'message_stop') {
              const response = data.response ?? fullResponse;
              const citations = data.citations ?? [];
              callbacks.onComplete(response, citations);
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error('Query failed'));
  }
}
