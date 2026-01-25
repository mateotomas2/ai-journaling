/**
 * Pattern Recognition Service
 * Detects recurring themes and patterns across journal chats
 */

import type { Message } from '../../types/entities';
import type { RecurringTheme } from './analysis';

export interface PatternInsight {
  /** Insight identifier */
  id: string;
  /** Type of insight */
  type: 'recurring_theme' | 'temporal_pattern' | 'sentiment_shift';
  /** Human-readable description */
  description: string;
  /** Strength/confidence of the pattern (0-1) */
  confidence: number;
  /** Related message IDs */
  relatedMessageIds: string[];
  /** Timestamp when insight was generated */
  generatedAt: number;
}

export interface TemporalPattern {
  /** Pattern identifier */
  id: string;
  /** Day IDs where pattern appears */
  dayIds: string[];
  /** Time range in milliseconds */
  timeRange: {
    start: number;
    end: number;
  };
  /** Frequency (how often it appears) */
  frequency: number;
}

/**
 * Generate insights from recurring themes
 * Converts raw theme data into human-readable insights
 */
export function generateThemeInsights(
  themes: RecurringTheme[],
  messages: Message[]
): PatternInsight[] {
  const insights: PatternInsight[] = [];

  for (const theme of themes) {
    // Get representative message for context
    const repMessage = messages.find((m) => m.id === theme.representativeMessageId);
    if (!repMessage) {
      continue;
    }

    // Extract key phrases from representative message (simple heuristic)
    const keyPhrase = extractKeyPhrase(repMessage.content);

    // Generate insight description
    let description: string;
    if (theme.frequency >= 10) {
      description = `You frequently write about "${keyPhrase}" (${theme.frequency} times)`;
    } else if (theme.frequency >= 5) {
      description = `"${keyPhrase}" is a recurring topic (${theme.frequency} times)`;
    } else {
      description = `You've mentioned "${keyPhrase}" several times (${theme.frequency} times)`;
    }

    insights.push({
      id: `theme-${theme.id}`,
      type: 'recurring_theme',
      description,
      confidence: theme.strength,
      relatedMessageIds: theme.messageIds,
      generatedAt: Date.now(),
    });
  }

  return insights;
}

/**
 * Detect temporal patterns in messages
 * Identifies themes that appear at specific times or intervals
 */
export function detectTemporalPatterns(
  themes: RecurringTheme[],
  messages: Message[]
): TemporalPattern[] {
  const patterns: TemporalPattern[] = [];

  for (const theme of themes) {
    // Get messages for this theme
    const themeMessages = messages.filter((m) =>
      theme.messageIds.includes(m.id)
    );

    if (themeMessages.length < 2) {
      continue;
    }

    // Get unique day IDs
    const dayIds = Array.from(new Set(themeMessages.map((m) => m.dayId))).sort();

    // Get time range
    const timestamps = themeMessages.map((m) => m.timestamp);
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);

    patterns.push({
      id: `temporal-${theme.id}`,
      dayIds,
      timeRange: { start, end },
      frequency: dayIds.length,
    });
  }

  return patterns;
}

/**
 * Analyze theme evolution over time
 * Detects if themes are increasing/decreasing in frequency
 */
export function analyzeThemeEvolution(
  themes: RecurringTheme[],
  messages: Message[],
  timeWindowDays: number = 30
): Map<string, 'increasing' | 'stable' | 'decreasing'> {
  const evolution = new Map<string, 'increasing' | 'stable' | 'decreasing'>();
  const now = Date.now();
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;

  for (const theme of themes) {
    const themeMessages = messages
      .filter((m) => theme.messageIds.includes(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (themeMessages.length < 4) {
      evolution.set(theme.id, 'stable');
      continue;
    }

    // Split into first half and second half
    const midpoint = Math.floor(themeMessages.length / 2);
    const firstHalf = themeMessages.slice(0, midpoint);
    const secondHalf = themeMessages.slice(midpoint);

    // Count occurrences in recent window
    const recentCount = secondHalf.filter(
      (m) => now - m.timestamp < windowMs
    ).length;
    const olderCount = firstHalf.filter(
      (m) => now - m.timestamp < windowMs * 2
    ).length;

    // Determine trend
    if (recentCount > olderCount * 1.5) {
      evolution.set(theme.id, 'increasing');
    } else if (recentCount < olderCount * 0.5) {
      evolution.set(theme.id, 'decreasing');
    } else {
      evolution.set(theme.id, 'stable');
    }
  }

  return evolution;
}

/**
 * Get summary of top recurring themes
 * Returns a concise summary for display
 */
export function getThemeSummary(
  themes: RecurringTheme[],
  messages: Message[],
  topN: number = 5
): string[] {
  const summaries: string[] = [];

  for (const theme of themes.slice(0, topN)) {
    const repMessage = messages.find((m) => m.id === theme.representativeMessageId);
    if (!repMessage) {
      continue;
    }

    const keyPhrase = extractKeyPhrase(repMessage.content);
    summaries.push(`${keyPhrase} (${theme.frequency}×)`);
  }

  return summaries;
}

/**
 * Extract key phrase from message content
 * Simple heuristic: take first meaningful phrase
 */
function extractKeyPhrase(content: string, maxLength: number = 40): string {
  // Remove leading/trailing whitespace
  let phrase = content.trim();

  // Take first sentence if available
  const sentenceEnd = phrase.search(/[.!?]\s/);
  if (sentenceEnd !== -1 && sentenceEnd < maxLength) {
    phrase = phrase.substring(0, sentenceEnd);
  } else {
    // Take first N characters
    phrase = phrase.substring(0, maxLength);

    // Truncate at last word boundary
    const lastSpace = phrase.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      phrase = phrase.substring(0, lastSpace);
    }
  }

  // Add ellipsis if truncated
  if (phrase.length < content.length) {
    phrase += '...';
  }

  return phrase;
}
