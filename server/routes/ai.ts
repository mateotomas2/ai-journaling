import { Router, type Request, type Response } from 'express';

const router = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

// T025: POST /api/chat - Proxy chat messages to OpenRouter GPT-4o
interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  apiKey: string;
  model?: string;
}

router.post('/chat', async (req: Request<object, unknown, ChatRequestBody>, res: Response) => {
  const { messages, apiKey, model } = req.body;

  console.log('[/api/chat] Received request');
  console.log('[/api/chat] Messages count:', messages?.length || 0);
  console.log('[/api/chat] API key present:', !!apiKey);
  console.log('[/api/chat] Model:', model || MODEL);

  if (!messages?.length) {
    console.log('[/api/chat] ERROR: No messages');
    res.status(400).json({ error: 'Messages required' });
    return;
  }
  if (!apiKey) {
    console.log('[/api/chat] ERROR: No API key');
    res.status(400).json({ error: 'API key required' });
    return;
  }

  console.log('[/api/chat] Sending request to OpenRouter...');

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://reflekt.app',
        'X-Title': 'Reflekt Journal',
      },
      body: JSON.stringify({
        model: model || MODEL,
        messages,
      }),
    });

    if (!response.ok) {
      console.log('[/api/chat] OpenRouter error status:', response.status);
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      console.log('[/api/chat] OpenRouter error data:', JSON.stringify(errorData));
      const errorMessage = errorData.error?.message || 'AI service error';

      if (response.status === 401) {
        console.log('[/api/chat] Returning: Invalid API key');
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
      if (response.status === 429) {
        console.log('[/api/chat] Returning: Rate limit exceeded');
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }
      console.log('[/api/chat] Returning error:', errorMessage);
      res.status(response.status).json({ error: errorMessage });
      return;
    }

    console.log('[/api/chat] OpenRouter request successful');

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'AI service error' });
  }
});

// T026: POST /api/summary - Generate daily summary from messages
interface SummaryRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  date: string;
  apiKey: string;
  model?: string;
}

const SUMMARY_SYSTEM_PROMPT = `You are a journal summarization assistant. Given a day's worth of journal entries (conversation between user and assistant), create a structured summary with the following sections:

1. **Journal**: General summary of events, activities, and experiences
2. **Insights**: Key realizations, patterns, or meaningful observations
3. **Health**: Sleep, energy, physical symptoms, exercise mentioned
4. **Dreams**: Any dreams or dream-related content

If a section has no relevant content, write "No [section] recorded for this day."

Respond ONLY with valid JSON in this exact format:
{
  "journal": "...",
  "insights": "...",
  "health": "...",
  "dreams": "..."
}`;

router.post('/summary', async (req: Request<object, unknown, SummaryRequestBody>, res: Response) => {
  const { messages, date, apiKey, model } = req.body;

  if (!messages?.length) {
    res.status(400).json({ error: 'Messages required' });
    return;
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !datePattern.test(date)) {
    res.status(400).json({ error: 'Invalid date format' });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ error: 'API key required' });
    return;
  }

  // Use provided model or fall back to default
  const summarizerModel = model || MODEL;

  try {
    const conversationText = messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://reflekt.app',
        'X-Title': 'Reflekt Journal',
      },
      body: JSON.stringify({
        model: summarizerModel,
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
      res.status(response.status).json({ error: errorMessage });
      return;
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
    // Match code blocks with optional language specifier
    const codeBlockMatch = jsonContent.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```\s*$/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
    } else if (jsonContent.startsWith('```')) {
      // Fallback: manually strip fences line by line
      const lines = jsonContent.split('\n');
      if (lines[0].startsWith('```')) {
        lines.shift(); // Remove opening fence line
      }
      if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
        lines.pop(); // Remove closing fence line
      }
      jsonContent = lines.join('\n').trim();
    }

    console.log('[/api/summary] Raw AI content:', content.substring(0, 200));
    console.log('[/api/summary] Parsed jsonContent:', jsonContent.substring(0, 200));

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

    res.json({ summary: sections, rawContent });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

// T027: POST /api/query - Query historical summaries with natural language
interface QueryRequestBody {
  query: string;
  summaries: Array<{ date: string; rawContent: string }>;
  apiKey: string;
}

const QUERY_SYSTEM_PROMPT = `You are a helpful assistant analyzing journal summaries. The user wants to query their past journal entries. You have access to summaries from multiple days.

When answering:
1. Base your response on the provided summaries
2. Be specific and reference relevant dates
3. Look for patterns across multiple days
4. If asked about something not in the summaries, say so

After your response, you MUST include citations. End your response with exactly this format:

---CITATIONS---
[{"date": "YYYY-MM-DD", "excerpt": "relevant quote from that day's summary"}, ...]

Include 1-5 relevant citations from the summaries that support your response.`;

router.post('/query', async (req: Request<object, unknown, QueryRequestBody>, res: Response) => {
  const { query, summaries, apiKey } = req.body;

  if (!query) {
    res.status(400).json({ error: 'Query required' });
    return;
  }
  if (!summaries?.length) {
    res.status(400).json({ error: 'Summaries required' });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: 'API key required' });
    return;
  }

  try {
    const summaryContext = summaries
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => `=== ${s.date} ===\n${s.rawContent}`)
      .join('\n\n');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://reflekt.app',
        'X-Title': 'Reflekt Journal',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: QUERY_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Here are my journal summaries:\n\n${summaryContext}\n\nMy question: ${query}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const errorMessage = errorData.error?.message || 'Query failed';
      res.status(response.status).json({ error: errorMessage });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const fullContent = data.choices[0]?.message?.content ?? '';

    // Parse citations from response
    const citationSplit = fullContent.split('---CITATIONS---');
    const responseText = citationSplit[0]?.trim() ?? fullContent;
    let citations: Array<{ date: string; excerpt: string }> = [];

    if (citationSplit[1]) {
      try {
        citations = JSON.parse(citationSplit[1].trim());
      } catch {
        // Ignore citation parsing errors
      }
    }

    res.json({ response: responseText, citations });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

export { router as aiRouter };
