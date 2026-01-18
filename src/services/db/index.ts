// Database initialization
export {
  initDatabase,
  getDatabase,
  isDatabaseInitialized,
  closeDatabase,
  databaseExists,
} from './database';

// Settings operations
export {
  getSettings,
  saveSettings,
  updateSettings,
  getApiKey,
  saveApiKey,
} from './settings';

// Day operations
export {
  createDay,
  getDay,
  getOrCreateDay,
  touchDay,
  markDayHasSummary,
  listDays,
  getDaysInRange,
} from './days';

// Message operations
export {
  addMessage,
  getMessagesForDay,
  getRecentMessages,
  countMessagesForDay,
  deleteMessage,
} from './messages';

// Summary operations
export {
  saveSummary,
  getSummaryForDay,
  getSummariesInRange,
  getRecentSummaries,
  hasSummary,
  deleteSummary,
} from './summaries';

// Schemas (for testing/debugging)
export {
  settingsSchema,
  daySchema,
  messageSchema,
  summarySchema,
} from './schemas';

// Export/Import operations
export { exportJournalData, downloadExport, exportDateRange } from './export';
export {
  importJournalData,
  importFromFile,
  validateImportData,
  type ImportData,
  type ImportResult,
} from './import';
