/**
 * Summary Trigger Logic
 * Determines when to generate summaries
 */

/**
 * Check if a day has ended (it's past midnight for that day)
 */
export function isDayEnded(dayId: string): boolean {
  const [today] = new Date().toISOString().split('T');
  return dayId < (today ?? '');
}

/**
 * Determine if we should generate a summary for a day
 *
 * @param dayId - The day to check (YYYY-MM-DD)
 * @param hasSummary - Whether the day already has a summary
 * @param hasMessages - Whether the day has any messages
 * @returns true if summary should be generated
 */
export function shouldGenerateSummary(
  dayId: string,
  hasSummary: boolean,
  hasMessages: boolean
): boolean {
  // Don't generate if summary already exists
  if (hasSummary) {
    return false;
  }

  // Don't generate if no messages to summarize
  if (!hasMessages) {
    return false;
  }

  // Only generate for past days (day has ended)
  return isDayEnded(dayId);
}

/**
 * Get days that need summary generation
 */
export function getDaysNeedingSummary(
  days: { id: string; hasSummary: boolean; hasMessages: boolean }[]
): string[] {
  return days
    .filter((day) => shouldGenerateSummary(day.id, day.hasSummary, day.hasMessages))
    .map((day) => day.id);
}
