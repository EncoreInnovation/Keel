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

import {
  deleteBlob,
  deleteKey,
  posturePhotoKey,
  readBlob,
  readKey,
  writeBlob,
  writeKey,
  STORAGE_KEYS,
} from './db';
import { runExclusive } from './mutex';
import type {
  Block,
  BodyMetricLog,
  ConditioningLog,
  PillarLog,
  PostureLog,
  PostureView,
  PrescribedSession,
  SessionLog,
  SetLog,
  UserProfile,
} from '../engine/types';

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
 * The player's live view of today's session: which exercise, which sets, at
 * what targets. Persisted separately from the lean `SessionRecord` so that
 * resuming after a kill shows the *current* (possibly autoregulated) targets
 * rather than re-deriving a session from scratch — regeneration is only ever
 * for starting a session that doesn't exist yet.
 */
export function getActivePrescription(): Promise<PrescribedSession | undefined> {
  return readKey<PrescribedSession>(STORAGE_KEYS.activePrescription);
}

export function saveActivePrescription(prescription: PrescribedSession): Promise<void> {
  return runExclusive('session', () => writeKey(STORAGE_KEYS.activePrescription, prescription));
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
 * since COLOSSUS only ever runs one session at a time by design.
 */
export function startSession(record: SessionRecord, prescription: PrescribedSession): Promise<void> {
  return runExclusive('session', async () => {
    await writeKey(STORAGE_KEYS.activeSession, record);
    await writeKey(STORAGE_KEYS.activePrescription, prescription);
  });
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
    await deleteKey(STORAGE_KEYS.activePrescription);

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
 * Pillar sessions
 *
 * Short enough (5-12 min) that there's no crash-resume concept, unlike a
 * strength session — a kill mid-breath is a "start over," not a "restore
 * exactly where I was." One entry is written on completion.
 * ------------------------------------------------------------------ */

export function getPillarLogs(): Promise<PillarLog[]> {
  return readKey<PillarLog[]>(STORAGE_KEYS.pillarLogs).then((v) => v ?? []);
}

export function appendPillarLog(entry: PillarLog): Promise<PillarLog[]> {
  return runExclusive('pillarLogs', async () => {
    const logs = (await readKey<PillarLog[]>(STORAGE_KEYS.pillarLogs)) ?? [];
    const next = [...logs, entry];
    await writeKey(STORAGE_KEYS.pillarLogs, next);
    return next;
  });
}

/* ------------------------------------------------------------------ *
 * Body metrics
 * ------------------------------------------------------------------ */

export function getBodyMetrics(): Promise<BodyMetricLog[]> {
  return readKey<BodyMetricLog[]>(STORAGE_KEYS.bodyMetrics).then((v) => v ?? []);
}

export function appendBodyMetric(entry: BodyMetricLog): Promise<BodyMetricLog[]> {
  return runExclusive('bodyMetrics', async () => {
    const logs = (await readKey<BodyMetricLog[]>(STORAGE_KEYS.bodyMetrics)) ?? [];
    const next = [...logs, entry].sort((a, b) => a.at - b.at);
    await writeKey(STORAGE_KEYS.bodyMetrics, next);
    return next;
  });
}

/* ------------------------------------------------------------------ *
 * Posture scan
 *
 * Photos are written to their own blob keys and never included in
 * `exportAll`/`importAll` — export is JSON, and a photo doesn't survive a
 * JSON round-trip. A future "export my photos" would be a separate,
 * explicit action, not a side effect of backing up training data.
 * ------------------------------------------------------------------ */

export function getPostureLogs(): Promise<PostureLog[]> {
  return readKey<PostureLog[]>(STORAGE_KEYS.postureLogs).then((v) => v ?? []);
}

export async function savePostureLog(
  entry: PostureLog,
  photos: Partial<Record<PostureView, Blob>>,
): Promise<PostureLog[]> {
  await Promise.all(
    (Object.entries(photos) as [PostureView, Blob | undefined][])
      .filter((pair): pair is [PostureView, Blob] => Boolean(pair[1]))
      .map(([view, blob]) => writeBlob(posturePhotoKey(entry.id, view), blob)),
  );

  return runExclusive('postureLogs', async () => {
    const logs = (await readKey<PostureLog[]>(STORAGE_KEYS.postureLogs)) ?? [];
    const next = [...logs, entry].sort((a, b) => a.at - b.at);
    await writeKey(STORAGE_KEYS.postureLogs, next);
    return next;
  });
}

export function getPosturePhoto(postureLogId: string, view: PostureView): Promise<Blob | undefined> {
  return readBlob(posturePhotoKey(postureLogId, view));
}

export async function deletePostureLog(id: string): Promise<PostureLog[]> {
  await Promise.all([deleteBlob(posturePhotoKey(id, 'front')), deleteBlob(posturePhotoKey(id, 'side'))]);
  return runExclusive('postureLogs', async () => {
    const logs = (await readKey<PostureLog[]>(STORAGE_KEYS.postureLogs)) ?? [];
    const next = logs.filter((l) => l.id !== id);
    await writeKey(STORAGE_KEYS.postureLogs, next);
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
  activePrescription?: PrescribedSession;
  completedSessions: SessionRecord[];
  conditioning: ConditioningLog[];
  pillarLogs: PillarLog[];
  bodyMetrics: BodyMetricLog[];
  /** Angles only — photos are on-device binaries and never part of a JSON export. */
  postureLogs: PostureLog[];
}

export async function exportAll(now: number): Promise<KeelExport> {
  const [
    profile,
    activeBlock,
    blockHistory,
    sets,
    activeSession,
    activePrescription,
    completedSessions,
    conditioning,
    pillarLogs,
    bodyMetrics,
    postureLogs,
  ] = await Promise.all([
    getProfile(),
    getActiveBlock(),
    getBlockHistory(),
    getAllSets(),
    getActiveSessionRecord(),
    getActivePrescription(),
    getCompletedSessions(),
    getConditioningLogs(),
    getPillarLogs(),
    getBodyMetrics(),
    getPostureLogs(),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    profile,
    activeBlock,
    blockHistory,
    sets,
    activeSession,
    activePrescription,
    completedSessions,
    conditioning,
    pillarLogs,
    bodyMetrics,
    postureLogs,
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
    setOrClear(STORAGE_KEYS.activePrescription, data.activePrescription),
    writeKey(STORAGE_KEYS.completedSessions, data.completedSessions),
    writeKey(STORAGE_KEYS.conditioning, data.conditioning),
    writeKey(STORAGE_KEYS.pillarLogs, data.pillarLogs),
    writeKey(STORAGE_KEYS.bodyMetrics, data.bodyMetrics),
    writeKey(STORAGE_KEYS.postureLogs, data.postureLogs),
  ]);
}
