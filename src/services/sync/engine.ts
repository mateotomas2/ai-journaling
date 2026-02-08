import type { JournalDatabase } from '@/db';
import type { SyncData } from '@/services/db/export';
import type { Day, Message, Summary, Note } from '@/types/entities';
import { encrypt, decrypt } from '@/services/crypto/encryption';
import { getAccessToken } from '@/services/google/auth';
import {
  findSyncFile,
  uploadSyncFile,
  downloadSyncFile,
  DriveApiError,
} from '@/services/google/drive';

export type SyncState = 'idle' | 'syncing' | 'error' | 'needs-reauth';

const DEBOUNCE_MS = 30_000;
const LS_ENABLED = 'reflekt_gdrive_enabled';
const LS_FILE_ID = 'reflekt_gdrive_file_id';
const LS_LAST_SYNC = 'reflekt_gdrive_last_sync';

export interface SyncStatus {
  state: SyncState;
  lastSyncTime: string | null;
  error: string | null;
}

export class SyncEngine {
  private db: JournalDatabase;
  private getEncryptionKey: () => Promise<CryptoKey>;
  private subscriptions: { unsubscribe(): void }[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: SyncStatus = {
    state: 'idle',
    lastSyncTime: localStorage.getItem(LS_LAST_SYNC),
    error: null,
  };
  private listeners: Array<(status: SyncStatus) => void> = [];

  constructor(
    db: JournalDatabase,
    getEncryptionKey: () => Promise<CryptoKey>,
  ) {
    this.db = db;
    this.getEncryptionKey = getEncryptionKey;
  }

  get status(): SyncStatus {
    return { ...this._status };
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private updateStatus(partial: Partial<SyncStatus>) {
    this._status = { ...this._status, ...partial };
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  async sync(): Promise<void> {
    if (this._status.state === 'syncing') return;

    this.updateStatus({ state: 'syncing', error: null });

    try {
      const token = await getAccessToken();
      if (!token) {
        this.updateStatus({ state: 'needs-reauth', error: 'Authentication required' });
        return;
      }

      const key = await this.getEncryptionKey();

      // Find existing sync file
      let fileId = localStorage.getItem(LS_FILE_ID);
      if (!fileId) {
        fileId = await findSyncFile(token);
        if (fileId) {
          localStorage.setItem(LS_FILE_ID, fileId);
        }
      }

      // Download remote data if exists
      let remoteData: SyncData | null = null;
      if (fileId) {
        try {
          const encrypted = await downloadSyncFile(fileId, token);
          const decrypted = await decrypt(encrypted, key);
          remoteData = JSON.parse(decrypted);
        } catch (err) {
          // If file exists but can't be decrypted (wrong key), skip merge
          console.warn('[Sync] Failed to decrypt remote data, will overwrite:', err);
          remoteData = null;
        }
      }

      // Export local data
      const localData = await this.exportLocalData();

      // Merge
      const merged = remoteData
        ? this.merge(localData, remoteData)
        : localData;

      // Import merged remote data into local DB
      if (remoteData) {
        await this.importMergedData(merged, localData);
      }

      // Encrypt and upload
      const json = JSON.stringify(merged);
      const encrypted = await encrypt(json, key);
      const newFileId = await uploadSyncFile(encrypted, token, fileId ?? undefined);

      localStorage.setItem(LS_FILE_ID, newFileId);
      const now = new Date().toISOString();
      localStorage.setItem(LS_LAST_SYNC, now);
      this.updateStatus({ state: 'idle', lastSyncTime: now });
    } catch (err) {
      if (err instanceof DriveApiError && err.status === 401) {
        this.updateStatus({
          state: 'needs-reauth',
          error: 'Authentication expired',
        });
      } else {
        const message = err instanceof Error ? err.message : 'Sync failed';
        console.error('[Sync] Error:', err);
        this.updateStatus({ state: 'error', error: message });
      }
    }
  }

  startAutoSync(): void {
    this.stopAutoSync();

    const handler = () => this.scheduleDebouncedSync();

    this.subscriptions.push(
      this.db.days.$.subscribe(handler),
      this.db.messages.$.subscribe(handler),
      this.db.notes.$.subscribe(handler),
      this.db.summaries.$.subscribe(handler),
    );
  }

  stopAutoSync(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleDebouncedSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.sync();
    }, DEBOUNCE_MS);
  }

  private async exportLocalData(): Promise<SyncData> {
    const [days, messages, summaries, notes] = await Promise.all([
      this.db.days.find().exec(),
      this.db.messages.find().exec(),
      this.db.summaries.find().exec(),
      this.db.notes.find().exec(),
    ]);

    return {
      version: '1.0.0',
      syncedAt: new Date().toISOString(),
      days: days.map((d) => d.toJSON() as Day),
      messages: messages.map((m) => m.toJSON() as Message),
      summaries: summaries.map((s) => s.toJSON() as Summary),
      notes: notes.map((n) => n.toJSON() as Note),
    };
  }

  private merge(local: SyncData, remote: SyncData): SyncData {
    const mergedDays = this.mergeDays(local.days, remote.days);
    const mergedMessages = this.mergeMessages(local.messages, remote.messages);
    const mergedSummaries = this.mergeSummaries(local.summaries, remote.summaries);
    const mergedNotes = this.mergeNotes(local.notes, remote.notes);

    return {
      version: '1.0.0',
      syncedAt: new Date().toISOString(),
      days: mergedDays,
      messages: mergedMessages,
      summaries: mergedSummaries,
      notes: mergedNotes,
    };
  }

  // Messages: append-only — insert if ID doesn't exist
  private mergeMessages(local: Message[], remote: Message[]): Message[] {
    const map = new Map<string, Message>();
    for (const msg of local) map.set(msg.id, msg);
    for (const msg of remote) {
      if (!map.has(msg.id)) map.set(msg.id, msg);
    }
    return Array.from(map.values());
  }

  // Days: insert if new; update if remote updatedAt > local updatedAt
  private mergeDays(local: Day[], remote: Day[]): Day[] {
    const map = new Map<string, Day>();
    for (const day of local) map.set(day.id, day);
    for (const day of remote) {
      const existing = map.get(day.id);
      if (!existing || day.updatedAt > existing.updatedAt) {
        map.set(day.id, day);
      }
    }
    return Array.from(map.values());
  }

  // Notes: insert if new; update if remote updatedAt > local updatedAt
  private mergeNotes(local: Note[], remote: Note[]): Note[] {
    const map = new Map<string, Note>();
    for (const note of local) map.set(note.id, note);
    for (const note of remote) {
      const existing = map.get(note.id);
      if (!existing || note.updatedAt > existing.updatedAt) {
        map.set(note.id, note);
      }
    }
    return Array.from(map.values());
  }

  // Summaries: insert if new; update if remote generatedAt > local generatedAt
  private mergeSummaries(local: Summary[], remote: Summary[]): Summary[] {
    const map = new Map<string, Summary>();
    for (const summary of local) map.set(summary.id, summary);
    for (const summary of remote) {
      const existing = map.get(summary.id);
      if (!existing || summary.generatedAt > existing.generatedAt) {
        map.set(summary.id, summary);
      }
    }
    return Array.from(map.values());
  }

  // Import only data from remote that local doesn't have or is newer
  private async importMergedData(
    merged: SyncData,
    local: SyncData,
  ): Promise<void> {
    const localDayIds = new Set(local.days.map((d) => d.id));
    const localMsgIds = new Set(local.messages.map((m) => m.id));
    const localSummaryIds = new Set(local.summaries.map((s) => s.id));
    const localNoteIds = new Set(local.notes.map((n) => n.id));

    const localDayMap = new Map(local.days.map((d) => [d.id, d]));
    const localSummaryMap = new Map(local.summaries.map((s) => [s.id, s]));
    const localNoteMap = new Map(local.notes.map((n) => [n.id, n]));

    // Upsert days
    for (const day of merged.days) {
      const localDay = localDayMap.get(day.id);
      if (!localDayIds.has(day.id)) {
        await this.db.days.insert(day);
      } else if (localDay && day.updatedAt > localDay.updatedAt) {
        const doc = await this.db.days.findOne(day.id).exec();
        if (doc) await doc.patch(day);
      }
    }

    // Insert new messages only
    for (const msg of merged.messages) {
      if (!localMsgIds.has(msg.id)) {
        await this.db.messages.insert(msg);
      }
    }

    // Upsert summaries
    for (const summary of merged.summaries) {
      const localSummary = localSummaryMap.get(summary.id);
      if (!localSummaryIds.has(summary.id)) {
        await this.db.summaries.insert(summary);
      } else if (localSummary && summary.generatedAt > localSummary.generatedAt) {
        const doc = await this.db.summaries.findOne(summary.id).exec();
        if (doc) await doc.patch(summary);
      }
    }

    // Upsert notes
    for (const note of merged.notes) {
      const localNote = localNoteMap.get(note.id);
      if (!localNoteIds.has(note.id)) {
        await this.db.notes.insert(note);
      } else if (localNote && note.updatedAt > localNote.updatedAt) {
        const doc = await this.db.notes.findOne(note.id).exec();
        if (doc) await doc.patch(note);
      }
    }
  }
}

export function isSyncEnabled(): boolean {
  return localStorage.getItem(LS_ENABLED) === 'true';
}

export function setSyncEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(LS_ENABLED, 'true');
  } else {
    localStorage.removeItem(LS_ENABLED);
    localStorage.removeItem(LS_FILE_ID);
    localStorage.removeItem(LS_LAST_SYNC);
  }
}
