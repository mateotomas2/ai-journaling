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
import { memoryIndexer } from '@/services/memory/indexer';

interface ImportResult {
  newMessageIds: string[];
  updatedMessageIds: string[];
  newNoteIds: string[];
  updatedNoteIds: string[];
}

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
  private getEncryptionKey: () => CryptoKey;
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
    getEncryptionKey: () => CryptoKey,
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

    console.log('[Sync] Starting sync...');
    this.updateStatus({ state: 'syncing', error: null });

    try {
      const token = await getAccessToken();
      if (!token) {
        console.log('[Sync] No access token — needs reauth');
        this.updateStatus({ state: 'needs-reauth', error: 'Authentication required' });
        return;
      }
      console.log('[Sync] Access token obtained');

      // Find existing sync file
      let fileId = localStorage.getItem(LS_FILE_ID);
      if (!fileId) {
        fileId = await findSyncFile(token);
        if (fileId) {
          localStorage.setItem(LS_FILE_ID, fileId);
        }
      }
      console.log('[Sync] File lookup:', fileId ? `fileId=${fileId}` : 'No remote file found (first sync)');

      // Download remote data if exists
      let remoteData: SyncData | null = null;
      if (fileId) {
        try {
          console.log('[Sync] Downloading remote data...');
          const raw = await downloadSyncFile(fileId, token);
          const key = this.getEncryptionKey();
          const decrypted = await decrypt(raw, key);
          remoteData = JSON.parse(decrypted);
          console.log('[Sync] Downloaded remote data:', {
            days: remoteData!.days.length,
            messages: remoteData!.messages.length,
            summaries: remoteData!.summaries.length,
            notes: remoteData!.notes.length,
          });
        } catch (err) {
          console.error('[Sync] Failed to decrypt remote data:', err);
          this.updateStatus({
            state: 'error',
            error: 'Failed to decrypt remote data. Make sure you use the same password on all devices.',
          });
          return;
        }
      }

      // Export local data
      const localData = await this.exportLocalData();
      console.log('[Sync] Local data:', {
        days: localData.days.length,
        messages: localData.messages.length,
        summaries: localData.summaries.length,
        notes: localData.notes.length,
      });

      // Merge
      const merged = remoteData
        ? this.merge(localData, remoteData)
        : localData;

      if (remoteData) {
        console.log('[Sync] Merged:', {
          days: `${merged.days.length} (+${merged.days.length - localData.days.length} new)`,
          messages: `${merged.messages.length} (+${merged.messages.length - localData.messages.length} new)`,
          summaries: `${merged.summaries.length} (+${merged.summaries.length - localData.summaries.length} new)`,
          notes: `${merged.notes.length} (+${merged.notes.length - localData.notes.length} new)`,
        });
      }

      // Import merged remote data into local DB
      if (remoteData) {
        const importResult = await this.importMergedData(merged, localData);
        this.queueImportedEntitiesForEmbedding(importResult);
      }

      // Encrypt and upload
      const json = JSON.stringify(merged);
      const key = this.getEncryptionKey();
      const encrypted = await encrypt(json, key);
      console.log(`[Sync] Uploading merged data (${encrypted.length} bytes)...`);
      const newFileId = await uploadSyncFile(encrypted, token, fileId ?? undefined);

      localStorage.setItem(LS_FILE_ID, newFileId);
      const now = new Date().toISOString();
      localStorage.setItem(LS_LAST_SYNC, now);
      this.updateStatus({ state: 'idle', lastSyncTime: now });
      console.log(`[Sync] Sync complete at ${now}`);
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
    console.log('[Sync] Auto-sync started, watching collections');

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
    console.log('[Sync] Change detected, scheduling sync in 30s');
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

  // Messages: insert if new; pick version with latest effective timestamp
  private mergeMessages(local: Message[], remote: Message[]): Message[] {
    const map = new Map<string, Message>();
    for (const msg of local) map.set(msg.id, msg);
    for (const msg of remote) {
      const existing = map.get(msg.id);
      if (!existing) {
        map.set(msg.id, msg);
      } else {
        const existingTs = Math.max(existing.timestamp, existing.deletedAt);
        const remoteTs = Math.max(msg.timestamp, msg.deletedAt);
        if (remoteTs > existingTs) map.set(msg.id, msg);
      }
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

  // Notes: insert if new; pick version with latest effective timestamp
  private mergeNotes(local: Note[], remote: Note[]): Note[] {
    const map = new Map<string, Note>();
    for (const note of local) map.set(note.id, note);
    for (const note of remote) {
      const existing = map.get(note.id);
      if (!existing) {
        map.set(note.id, note);
      } else {
        const existingTs = Math.max(existing.updatedAt, existing.deletedAt);
        const remoteTs = Math.max(note.updatedAt, note.deletedAt);
        if (remoteTs > existingTs) map.set(note.id, note);
      }
    }
    return Array.from(map.values());
  }

  // Summaries: insert if new; pick version with latest effective timestamp
  private mergeSummaries(local: Summary[], remote: Summary[]): Summary[] {
    const map = new Map<string, Summary>();
    for (const summary of local) map.set(summary.id, summary);
    for (const summary of remote) {
      const existing = map.get(summary.id);
      if (!existing) {
        map.set(summary.id, summary);
      } else {
        const existingTs = Math.max(existing.generatedAt, existing.deletedAt);
        const remoteTs = Math.max(summary.generatedAt, summary.deletedAt);
        if (remoteTs > existingTs) map.set(summary.id, summary);
      }
    }
    return Array.from(map.values());
  }

  private queueImportedEntitiesForEmbedding(result: ImportResult): void {
    const { newMessageIds, updatedMessageIds, newNoteIds, updatedNoteIds } = result;
    const totalQueued = newMessageIds.length + updatedMessageIds.length + newNoteIds.length + updatedNoteIds.length;

    if (totalQueued === 0) return;

    for (const id of newMessageIds) memoryIndexer.queueEntityForEmbedding('message', id);
    for (const id of updatedMessageIds) memoryIndexer.queueEntityForEmbedding('message', id);
    for (const id of newNoteIds) memoryIndexer.queueEntityForEmbedding('note', id);
    for (const id of updatedNoteIds) memoryIndexer.queueEntityForEmbedding('note', id);

    console.log(`[Sync] Queued ${totalQueued} imported entities for embedding`);

    // Process queue in background (non-blocking)
    memoryIndexer.processQueue().catch((err) => {
      console.error('[Sync] Background embedding queue processing failed:', err);
    });
  }

  // Import only data from remote that local doesn't have or is newer
  private async importMergedData(
    merged: SyncData,
    local: SyncData,
  ): Promise<ImportResult> {
    const localDayIds = new Set(local.days.map((d) => d.id));
    const localMsgIds = new Set(local.messages.map((m) => m.id));
    const localMsgMap = new Map(local.messages.map((m) => [m.id, m]));
    const localSummaryIds = new Set(local.summaries.map((s) => s.id));
    const localNoteIds = new Set(local.notes.map((n) => n.id));

    const localDayMap = new Map(local.days.map((d) => [d.id, d]));
    const localSummaryMap = new Map(local.summaries.map((s) => [s.id, s]));
    const localNoteMap = new Map(local.notes.map((n) => [n.id, n]));

    // Compute import stats
    const newDays = merged.days.filter((d) => !localDayIds.has(d.id));
    const updatedDays = merged.days.filter((d) => {
      const ld = localDayMap.get(d.id);
      return ld && d.updatedAt > ld.updatedAt;
    });
    const newMessages = merged.messages.filter((m) => !localMsgIds.has(m.id));
    const updatedMessages = merged.messages.filter((m) => {
      const lm = localMsgMap.get(m.id);
      if (!lm) return false;
      const localTs = Math.max(lm.timestamp, lm.deletedAt);
      const remoteTs = Math.max(m.timestamp, m.deletedAt);
      return remoteTs > localTs;
    });
    const newSummaries = merged.summaries.filter((s) => !localSummaryIds.has(s.id));
    const updatedSummaries = merged.summaries.filter((s) => {
      const ls = localSummaryMap.get(s.id);
      return ls && s.generatedAt > ls.generatedAt;
    });
    const newNotes = merged.notes.filter((n) => !localNoteIds.has(n.id));
    const updatedNotes = merged.notes.filter((n) => {
      const ln = localNoteMap.get(n.id);
      return ln && n.updatedAt > ln.updatedAt;
    });

    console.log('[Sync] Importing:', {
      days: `${newDays.length} new, ${updatedDays.length} updated`,
      messages: `${newMessages.length} new, ${updatedMessages.length} updated`,
      summaries: `${newSummaries.length} new, ${updatedSummaries.length} updated`,
      notes: `${newNotes.length} new, ${updatedNotes.length} updated`,
    });

    // Upsert days
    for (const day of merged.days) {
      const localDay = localDayMap.get(day.id);
      try {
        if (!localDayIds.has(day.id)) {
          await this.db.days.insert(day);
        } else if (localDay && day.updatedAt > localDay.updatedAt) {
          const doc = await this.db.days.findOne(day.id).exec();
          if (doc) await doc.patch(day);
        }
      } catch (err) {
        console.error(`[Sync] Failed to import day ${day.id}:`, err);
      }
    }

    // Upsert messages (new or updated via soft delete)
    for (const msg of merged.messages) {
      const localMsg = localMsgMap.get(msg.id);
      try {
        if (!localMsgIds.has(msg.id)) {
          await this.db.messages.insert(msg);
        } else if (localMsg) {
          const localTs = Math.max(localMsg.timestamp, localMsg.deletedAt);
          const mergedTs = Math.max(msg.timestamp, msg.deletedAt);
          if (mergedTs > localTs) {
            const doc = await this.db.messages.findOne(msg.id).exec();
            if (doc) await doc.patch(msg);
          }
        }
      } catch (err) {
        console.error(`[Sync] Failed to import message ${msg.id}:`, err);
      }
    }

    // Upsert summaries
    for (const summary of merged.summaries) {
      const localSummary = localSummaryMap.get(summary.id);
      try {
        if (!localSummaryIds.has(summary.id)) {
          await this.db.summaries.insert(summary);
        } else if (localSummary) {
          const localTs = Math.max(localSummary.generatedAt, localSummary.deletedAt);
          const mergedTs = Math.max(summary.generatedAt, summary.deletedAt);
          if (mergedTs > localTs) {
            const doc = await this.db.summaries.findOne(summary.id).exec();
            if (doc) await doc.patch(summary);
          }
        }
      } catch (err) {
        console.error(`[Sync] Failed to import summary ${summary.id}:`, err);
      }
    }

    // Upsert notes
    for (const note of merged.notes) {
      const localNote = localNoteMap.get(note.id);
      try {
        if (!localNoteIds.has(note.id)) {
          await this.db.notes.insert(note);
        } else if (localNote) {
          const localTs = Math.max(localNote.updatedAt, localNote.deletedAt);
          const mergedTs = Math.max(note.updatedAt, note.deletedAt);
          if (mergedTs > localTs) {
            const doc = await this.db.notes.findOne(note.id).exec();
            if (doc) await doc.patch(note);
          }
        }
      } catch (err) {
        console.error(`[Sync] Failed to import note ${note.id}:`, err);
      }
    }

    return {
      newMessageIds: newMessages.filter((m) => m.deletedAt === 0).map((m) => m.id),
      updatedMessageIds: updatedMessages.filter((m) => m.deletedAt === 0).map((m) => m.id),
      newNoteIds: newNotes.filter((n) => n.deletedAt === 0).map((n) => n.id),
      updatedNoteIds: updatedNotes.filter((n) => n.deletedAt === 0).map((n) => n.id),
    };
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
