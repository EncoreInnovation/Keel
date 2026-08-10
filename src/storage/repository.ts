/**
 * Domain-level persistence.
 *
 * The one guarantee this module exists to provide: a completed set is on
 * disk before the tap that logged it finishes, and the session it belongs to
 * can be reconstructed from nothing but what's in IndexedDB. Kill the app,
 * kill the tab, let the phone die mid-set — reopening restores the exact set
 * you were on, because that set was never only sitting in memory.
 *
 * The flat `sets` array is the single source of truth for every logged rep.
 * Session records never embed their own copy of it — they're joined by
 * `sessionId` on read — so there is exactly one place a set can go missing,
 * and exactly one place to look if the numbers ever look wrong.
 */

import { deleteKey, readKey, writeKey, STORAGE_KEYS } from './db';
import { runExclusive } from './mutex';
import type { Block, ConditioningLog, SessionLog, SetLog, UserProfile } from '../engine/types';

export const SCHEMA_VERSION = 1;

/** A session as stored — everything about the session except its sets, which live in the flat log. */
export type SessionRecord = Omit<SessionLog, 'sets'>;

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */

export function getProfile(): Promise<UserProfile | undefined> {
  return readKey<UserProfile>(STORAGE_KEYS.profile);
}

export function saveProfile(profile: UserProfile): Promise<void> {
  return writeKey(STORAGE_KEYS.profile, profile);
}

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

export function getActiveBlock(): Promise<Block | undefined> {
  return readKey<Block>(STORAGE_KEYS.activeBlock);
}

export function getBlockHistory(): Promise<Block[]> {
  return readKey<Block[]>(STORAGE_KEYS.blockHistory).then((v) => v ?? []);
}

/**
 * Retire the current active block into history and make `next` the active
 * one. A block is never silently discarded — every one you've ever run stays
 * queryable for the Progress screen's e1RM and ladder trends.
 */
export async function startNewBlock(next: Block): Promise<void> {
  return runExclusive('block', async () => {
    const current = await readKey<Block>(STORAGE_KEYS.activeBlock);
    if (current) {
      const history = (await readKey<Block[]>(STORAGE_KEYS.blockHistory)) ?? [];
      await writeKey(STORAGE_KEYS.blockHistory, [...history, current]);
    }
    await writeKey(STORAGE_KEYS.activeBlock, next);
  });
}

/** Update the active block in place — used when a locked primary is first assigned. */
export function saveActiveBlock(block: Block): Promise<void> {
  return runExclusive('block', () => writeKey(STORAGE_KEYS.activeBlock, block));
}

/* ------------------------------------------------------------------ *
 * Sets — the flat, canonical log
 * ------------------------------------------------------------------ */

export function getAllSets(): Promise<SetLog[]> {
  return readKey<SetLog[]>(STORAGE_KEYS.sets).then((v) => v ?? []);
}

/**
 * Append one set and return once it is durably written.
 *
 * Serialised through the mutex so two DONE taps arriving close together
 * can't interleave their read-modify-write and silently drop one.
 */
export function appendSet(entry: SetLog): Promise<SetLog[]> {
  return runExclusive('sets', async () => {
    const sets = (await readKey<SetLog[]>(STORAGE_KEYS.sets)) ?? [];
    const next = [...sets, entry];
    await writeKey(STORAGE_KEYS.sets, next);
    return next;
  });
}

/** Bulk variant for import and for logging several sides of one set together. */
export function appendSets(entries: SetLog[]): Promise<SetLog[]> {
  if (entries.length === 0) return getAllSets();
  return runExclusive('sets', async () => {
    const sets = (await readKey<SetLog[]>(STORAGE_KEYS.sets)) ?? [];
    const next = [...sets, ...entries];
    await writeKey(STORAGE_KEYS.sets, next);
    return next;
  });
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

export function getCompletedSessions(): Promise<SessionRecord[]> {
  return readKey<SessionRecord[]>(STORAGE_KEYS.completedSessions).then((v) => v ?? []);
}

/** Completed sessions belonging to one block — what `nextDay()` needs to know the rotation. */
export async function getCompletedSessionsForBlock(blockId: string): Promise<SessionRecord[]> {
  const all = await getCompletedSessions();
  return all.filter((s) => s.blockId === blockId).sort((a, b) => a.startedAt - b.startedAt);
}

export function getActiveSessionRecord(): Promise<SessionRecord | undefined> {
  return readKey<SessionRecord>(STORAGE_KEYS.activeSession);
}

/**
 * Reconstruct the in-progress session, joining its record with every set
 * logged under its id. This is the exact call the player makes on load to
 * decide whether it's resuming something or starting fresh.
 */
export async function getActiveSession(): Promise<SessionLog | undefined> {
  const record = await getActiveSessionRecord();
  if (!record) return undefined;
  const allSets = await getAllSets();
  return { ...record, sets: allSets.filter((s) => s.sessionId === record.id) };
}

/**
 * Begin a session. Overwrites any existing active-session pointer — the
 * caller is responsible for having resolved or abandoned a prior one first,
 * since KEEL only ever runs one session at a time by design.
 */
export function startSession(record: SessionRecord): Promise<void> {
  return runExclusive('session', () => writeKey(STORAGE_KEYS.activeSession, record));
}

export async function updateActiveSessionMeta(
  patch: Partial<Pick<SessionRecord, 'readiness' | 'notes'>>,
): Promise<void> {
  return runExclusive('session', async () => {
    const record = await readKey<SessionRecord>(STORAGE_KEYS.activeSession);
    if (!record) return;
    await writeKey(STORAGE_KEYS.activeSession, { ...record, ...patch });
  });
}

/**
 * Close out the active session: stamp completion, file it under the
 * completed list, and clear the active pointer — in that order, so a crash
 * between steps never loses the record, only at worst leaves it double-filed
 * (harmless; `nextDay` de-dupes by session id upstream if that ever matters).
 */
export async function completeActiveSession(completedAt: number): Promise<SessionLog | undefined> {
  return runExclusive('session', async () => {
    const record = await readKey<SessionRecord>(STORAGE_KEYS.activeSession);
    if (!record) return undefined;

    const finished: SessionRecord = { ...record, completedAt };
    const completed = (await readKey<SessionRecord[]>(STORAGE_KEYS.completedSessions)) ?? [];
    await writeKey(STORAGE_KEYS.completedSessions, [...completed, finished]);
    await deleteKey(STORAGE_KEYS.activeSession);

    const allSets = await readKey<SetLog[]>(STORAGE_KEYS.sets);
    return { ...finished, sets: (allSets ?? []).filter((s) => s.sessionId === finished.id) };
  });
}

/* ------------------------------------------------------------------ *
 * Conditioning
 * ------------------------------------------------------------------ */

export function getConditioningLogs(): Promise<ConditioningLog[]> {
  return readKey<ConditioningLog[]>(STORAGE_KEYS.conditioning).then((v) => v ?? []);
}

export function appendConditioningLog(entry: ConditioningLog): Promise<ConditioningLog[]> {
  return runExclusive('conditioning', async () => {
    const logs = (await readKey<ConditioningLog[]>(STORAGE_KEYS.conditioning)) ?? [];
    const next = [...logs, entry];
    await writeKey(STORAGE_KEYS.conditioning, next);
    return next;
  });
}

/* ------------------------------------------------------------------ *
 * Export / import — the whole point of local-first with no account
 * ------------------------------------------------------------------ */

export interface KeelExport {
  schemaVersion: number;
  exportedAt: number;
  profile?: UserProfile;
  activeBlock?: Block;
  blockHistory: Block[];
  sets: SetLog[];
  activeSession?: SessionRecord;
  completedSessions: SessionRecord[];
  conditioning: ConditioningLog[];
}

export async function exportAll(now: number): Promise<KeelExport> {
  const [profile, activeBlock, blockHistory, sets, activeSession, completedSessions, conditioning] =
    await Promise.all([
      getProfile(),
      getActiveBlock(),
      getBlockHistory(),
      getAllSets(),
      getActiveSessionRecord(),
      getCompletedSessions(),
      getConditioningLogs(),
    ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    profile,
    activeBlock,
    blockHistory,
    sets,
    activeSession,
    completedSessions,
    conditioning,
  };
}

/**
 * Replace everything with a previously exported snapshot.
 *
 * This is a full overwrite, not a merge — importing is how you move to a new
 * phone or recover from a wipe, not how you sync two devices. Merging two
 * independently-grown histories correctly is a much harder problem than this
 * single-user app needs to solve.
 */
export async function importAll(data: KeelExport): Promise<void> {
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Cannot import schema version ${data.schemaVersion} into version ${SCHEMA_VERSION}.`,
    );
  }

  // `undefined` is not a value IndexedDB reliably round-trips, so an absent
  // optional field means "delete the key," not "write undefined into it."
  const setOrClear = <T>(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS], value: T | undefined) =>
    value === undefined ? deleteKey(key) : writeKey(key, value);

  await Promise.all([
    setOrClear(STORAGE_KEYS.profile, data.profile),
    setOrClear(STORAGE_KEYS.activeBlock, data.activeBlock),
    writeKey(STORAGE_KEYS.blockHistory, data.blockHistory),
    writeKey(STORAGE_KEYS.sets, data.sets),
    setOrClear(STORAGE_KEYS.activeSession, data.activeSession),
    writeKey(STORAGE_KEYS.completedSessions, data.completedSessions),
    writeKey(STORAGE_KEYS.conditioning, data.conditioning),
  ]);
}
