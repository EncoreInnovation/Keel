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

export const keelStore = createStore('keel-db', 'kv');

export const STORAGE_KEYS = {
  profile: 'profile',
  activeBlock: 'block:active',
  blockHistory: 'block:history',
  sets: 'sets',
  activeSession: 'session:active',
  completedSessions: 'sessions:completed',
  conditioning: 'conditioning',
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
