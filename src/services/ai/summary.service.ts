import type { Message } from '../../types/entities';
import type { SummaryResponse } from '../../types/ai';

export async function generateSummary(
  messages: Message[],
  date: string
): Promise<SummaryResponse> {
  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json() as { error?: string };
    throw new Error(errorData.error ?? 'Failed to generate summary');
  }

  return response.json() as Promise<SummaryResponse>;
}
