import type { Message } from '../../types/entities';
import type { SummaryResponse } from '../../types/ai';
import { SUMMARY_SYSTEM_PROMPT } from './prompts';

export async function generateSummary(
  messages: Message[],
  date: string,
  apiKey: string,
  model?: string
): Promise<SummaryResponse> {
  // Sort and format conversation
  const conversationText = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reflekt.app',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o',
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Please summarize the following journal conversation from ${date}:\n\n${conversationText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const errorMessage = errorData.error?.message || 'Summary generation failed';
    throw new Error(errorMessage);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  let jsonContent = content.trim();
  const codeBlockMatch = jsonContent.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonContent = codeBlockMatch[1].trim();
  } else if (jsonContent.startsWith('```')) {
    const lines = jsonContent.split('\n');
    if (lines[0] && lines[0].startsWith('```')) {
      lines.shift();
    }
    const lastLine = lines[lines.length - 1];
    if (lines.length > 0 && lastLine && lastLine.trim() === '```') {
      lines.pop();
    }
    jsonContent = lines.join('\n').trim();
  }

  const sections = JSON.parse(jsonContent) as {
    journal: string;
    insights: string;
    health: string;
    dreams: string;
  };

  const rawContent = `## Journal
${sections.journal}

## Insights
${sections.insights}

## Health
${sections.health}

## Dreams
${sections.dreams}`;

  return { summary: sections, rawContent };
}
