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

const SELECTED_TAB_KEY = 'selected-tab';

export type ViewMode = 'chat' | 'notes';

/**
 * Get the selected tab from sessionStorage
 * @returns The selected tab or 'notes' as default
 */
export function getSelectedTab(): ViewMode {
  try {
    const tab = sessionStorage.getItem(SELECTED_TAB_KEY);
    if (tab === 'chat' || tab === 'notes') {
      return tab;
    }
    return 'notes';
  } catch (error) {
    console.error('Failed to get selected tab from sessionStorage:', error);
    return 'notes';
  }
}

/**
 * Save the selected tab to sessionStorage
 * @param tab - The tab to save ('chat' or 'notes')
 */
export function setSelectedTab(tab: ViewMode): void {
  try {
    sessionStorage.setItem(SELECTED_TAB_KEY, tab);
  } catch (error) {
    console.error('Failed to save selected tab to sessionStorage:', error);
  }
}
