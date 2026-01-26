/**
 * Session persistence utilities for storing selected day across navigation within a session.
 * Uses sessionStorage to persist only during the current browser session.
 */

const SELECTED_DAY_KEY = 'selected-day';

/**
 * Get the selected day from sessionStorage
 * @returns The selected day ID or null if not set
 */
export function getSelectedDay(): string | null {
  try {
    return sessionStorage.getItem(SELECTED_DAY_KEY);
  } catch (error) {
    console.error('Failed to get selected day from sessionStorage:', error);
    return null;
  }
}

/**
 * Save the selected day to sessionStorage
 * @param dayId - The day ID to save (format: YYYY-MM-DD)
 */
export function setSelectedDay(dayId: string): void {
  try {
    sessionStorage.setItem(SELECTED_DAY_KEY, dayId);
  } catch (error) {
    console.error('Failed to save selected day to sessionStorage:', error);
  }
}

/**
 * Clear the selected day from sessionStorage
 */
export function clearSelectedDay(): void {
  try {
    sessionStorage.removeItem(SELECTED_DAY_KEY);
  } catch (error) {
    console.error('Failed to clear selected day from sessionStorage:', error);
  }
}
