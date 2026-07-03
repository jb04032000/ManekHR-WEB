/**
 * IndexedDB persistence layer for finance voucher drafts.
 * Per F-02 D-07. Key format: finance_draft_{wsId}_{firmId}_{voucherType}_{draftId}
 */
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'finance_drafts';
const STORE = 'drafts';
const VERSION = 1;

export interface DraftRecord {
  key: string;
  workspaceId: string;
  firmId: string;
  voucherType: string;
  draftId: string;
  data: unknown;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDraftDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveDraft(
  record: Omit<DraftRecord, 'updatedAt'>,
): Promise<DraftRecord> {
  const db = await getDraftDB();
  const full: DraftRecord = { ...record, updatedAt: Date.now() };
  await db.put(STORE, full, record.key);
  return full;
}

export async function loadDraft(key: string): Promise<DraftRecord | undefined> {
  const db = await getDraftDB();
  return db.get(STORE, key);
}

export async function listDrafts(prefix: string): Promise<DraftRecord[]> {
  const db = await getDraftDB();
  const all = (await db.getAll(STORE)) as DraftRecord[];
  return all.filter((r) => r.key.startsWith(prefix));
}

export async function deleteDraft(key: string): Promise<void> {
  const db = await getDraftDB();
  await db.delete(STORE, key);
}
