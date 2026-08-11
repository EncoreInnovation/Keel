/**
 * IndexedDB access, via `idb-keyval` against a dedicated database.
 *
 * A handful of namespaced keys, each holding one JSON-serialisable value.
 * At this app's scale — one user, a few thousand sets a year — a single
 * key holding a full array is simpler and just as fast as a proper indexed
 * object store, and it keeps every read a single `get()` with no query
 * layer to get wrong.
 */

import { createStore, del, get, set } from 'idb-keyval';

// The database name is intentionally left as 'keel-db' from the original
// build, not renamed to match the COLOSSUS branding — IndexedDB opens by
// name, so a rename here would silently start every existing install on an
// empty database and orphan real training history. Cosmetic only; never
// touch this string on a rebrand.
export const keelStore = createStore('keel-db', 'kv');

export const STORAGE_KEYS = {
  profile: 'profile',
  activeBlock: 'block:active',
  blockHistory: 'block:history',
  sets: 'sets',
  activeSession: 'session:active',
  activePrescription: 'session:active:prescription',
  completedSessions: 'sessions:completed',
  conditioning: 'conditioning',
  pillarLogs: 'pillar:logs',
  bodyMetrics: 'body:metrics',
  postureLogs: 'posture:logs',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readKey<T>(key: StorageKey): Promise<T | undefined> {
  return get<T>(key, keelStore);
}

export function writeKey<T>(key: StorageKey, value: T): Promise<void> {
  return set(key, value, keelStore);
}

export function deleteKey(key: StorageKey): Promise<void> {
  return del(key, keelStore);
}

/**
 * Posture photos, one Blob per key, namespaced separately from the JSON
 * value keys above — binary and per-id, so folding them into one of the
 * array-valued keys would mean rewriting every photo on every unrelated
 * write. IndexedDB stores Blobs natively via structured clone; nothing here
 * ever leaves the device.
 */
export function posturePhotoKey(postureLogId: string, view: 'front' | 'side'): string {
  return `posture:photo:${postureLogId}:${view}`;
}

export function readBlob(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, keelStore);
}

export function writeBlob(key: string, blob: Blob): Promise<void> {
  return set(key, blob, keelStore);
}

export function deleteBlob(key: string): Promise<void> {
  return del(key, keelStore);
}
