/**
 * Storage tests, run against a real (in-memory) IndexedDB via
 * `fake-indexeddb/auto` — see tests/setup.ts. These exercise the actual
 * guarantee the plan promised: a completed set is durably written before the
 * tap that logged it resolves, and a session survives being torn down and
 * reconstructed from disk alone.
 */

import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { keelStore } from '../src/storage/db';
import {
  appendConditioningLog,
  appendSet,
  appendSets,
  completeActiveSession,
  exportAll,
  getActiveSession,
  getActiveSessionRecord,
  getAllSets,
  getCompletedSessionsForBlock,
  getConditioningLogs,
  importAll,
  saveProfile,
  getProfile,
  startNewBlock,
  startSession,
  SCHEMA_VERSION,
  type SessionRecord,
} from '../src/storage/repository';
import type { Block, ConditioningLog, SetLog, UserProfile } from '../src/engine/types';

beforeEach(async () => {
  await clear(keelStore);
});

const T0 = 1_700_000_000_000;

function makeSet(over: Partial<SetLog> = {}): SetLog {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId: 'sess-1',
    exerciseId: 'goblet-squat',
    setIndex: 0,
    side: 'both',
    weight: 45,
    reps: 10,
    rpe: 8,
    completedAt: T0,
    ...over,
  };
}

function makeBlock(over: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    name: 'Cruise Block',
    weeks: 6,
    deloadWeek: 6,
    days: [],
    startedAt: T0,
    lockedAssignments: {},
    ...over,
  };
}

const PROFILE: UserProfile = {
  bodyweight: 292,
  level: 'novice',
  availableEquipment: ['bodyweight', 'dumbbell'],
  dumbbellIncrement: 5,
  flaggedJoints: [],
  impactCeiling: 'low',
  daysPerWeek: 4,
  sessionMinutes: 40,
};

describe('profile', () => {
  it('round-trips', async () => {
    expect(await getProfile()).toBeUndefined();
    await saveProfile(PROFILE);
    expect(await getProfile()).toEqual(PROFILE);
  });
});

describe('appendSet — the durability guarantee', () => {
  it('is on disk the instant the write resolves, readable from a fresh call', async () => {
    const entry = makeSet();
    await appendSet(entry);

    // No in-memory cache in the repository — this read hits IndexedDB fresh,
    // standing in for "the app was killed and relaunched."
    const sets = await getAllSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual(entry);
  });

  it('preserves every set across many sequential taps', async () => {
    for (let i = 0; i < 5; i += 1) {
      await appendSet(makeSet({ id: `s${i}`, setIndex: i }));
    }
    expect((await getAllSets()).map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('never loses a write when two taps race', async () => {
    // Fired without awaiting between them — the exact shape of a rest timer
    // autosave landing the same instant as a manual DONE tap.
    const writes = Array.from({ length: 20 }, (_, i) => appendSet(makeSet({ id: `race-${i}` })));
    await Promise.all(writes);

    const sets = await getAllSets();
    expect(sets).toHaveLength(20);
    expect(new Set(sets.map((s) => s.id)).size).toBe(20);
  });

  it('bulk-appends both sides of a unilateral set together', async () => {
    await appendSets([
      makeSet({ id: 'l', side: 'left' }),
      makeSet({ id: 'r', side: 'right', setIndex: 0 }),
    ]);
    expect(await getAllSets()).toHaveLength(2);
  });
});

describe('session lifecycle', () => {
  const record: SessionRecord = {
    id: 'sess-1',
    blockId: 'block-1',
    weekNumber: 1,
    dayId: 'a',
    startedAt: T0,
  };

  it('has no active session before one starts', async () => {
    expect(await getActiveSessionRecord()).toBeUndefined();
    expect(await getActiveSession()).toBeUndefined();
  });

  it('resumes an in-progress session with exactly the sets logged so far', async () => {
    await startSession(record);
    await appendSet(makeSet({ id: 'a', sessionId: 'sess-1', setIndex: 0 }));
    await appendSet(makeSet({ id: 'b', sessionId: 'sess-1', setIndex: 1 }));
    // A set from some other session must never bleed into this one.
    await appendSet(makeSet({ id: 'other', sessionId: 'sess-other', setIndex: 0 }));

    const active = await getActiveSession();
    expect(active?.id).toBe('sess-1');
    expect(active?.sets.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('completing a session clears the active pointer and files it as completed', async () => {
    await startSession(record);
    await appendSet(makeSet({ id: 'a', sessionId: 'sess-1' }));

    const finished = await completeActiveSession(T0 + 60_000);
    expect(finished?.completedAt).toBe(T0 + 60_000);
    expect(finished?.sets.map((s) => s.id)).toEqual(['a']);

    expect(await getActiveSessionRecord()).toBeUndefined();
    expect(await getActiveSession()).toBeUndefined();

    // The set itself is untouched — the flat log is the only place it lives.
    expect(await getAllSets()).toHaveLength(1);
  });

  it('completing with nothing active is a no-op, not an error', async () => {
    await expect(completeActiveSession(T0)).resolves.toBeUndefined();
  });

  it('lists completed sessions scoped to one block', async () => {
    await startSession({ ...record, id: 's1', blockId: 'block-1' });
    await completeActiveSession(T0 + 1000);
    await startSession({ ...record, id: 's2', blockId: 'block-2' });
    await completeActiveSession(T0 + 2000);
    await startSession({ ...record, id: 's3', blockId: 'block-1' });
    await completeActiveSession(T0 + 3000);

    const block1 = await getCompletedSessionsForBlock('block-1');
    expect(block1.map((s) => s.id)).toEqual(['s1', 's3']);
  });
});

describe('blocks', () => {
  it('retires the previous active block into history rather than discarding it', async () => {
    const first = makeBlock({ id: 'block-1' });
    const second = makeBlock({ id: 'block-2', startedAt: T0 + 1000 });

    await startNewBlock(first);
    await startNewBlock(second);

    const { getActiveBlock, getBlockHistory } = await import('../src/storage/repository');
    expect((await getActiveBlock())?.id).toBe('block-2');
    expect((await getBlockHistory()).map((b) => b.id)).toEqual(['block-1']);
  });
});

describe('conditioning', () => {
  it('appends and lists', async () => {
    const run: ConditioningLog = {
      id: 'run-1',
      kind: 'run',
      startedAt: T0,
      durationSec: 1800,
      effort: 6,
      impact: 'moderate',
      source: 'manual',
    };
    await appendConditioningLog(run);
    expect(await getConditioningLogs()).toEqual([run]);
  });
});

describe('export / import', () => {
  it('round-trips a full snapshot', async () => {
    await saveProfile(PROFILE);
    await startNewBlock(makeBlock());
    await appendSet(makeSet({ id: 'x' }));
    await appendConditioningLog({
      id: 'c1',
      kind: 'walk',
      startedAt: T0,
      durationSec: 600,
      effort: 3,
      impact: 'none',
      source: 'manual',
    });

    const snapshot = await exportAll(T0 + 500);
    expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snapshot.sets).toHaveLength(1);
    expect(snapshot.profile).toEqual(PROFILE);

    await clear(keelStore);
    expect(await getProfile()).toBeUndefined();

    await importAll(snapshot);
    expect(await getProfile()).toEqual(PROFILE);
    expect(await getAllSets()).toHaveLength(1);
    expect((await import('../src/storage/repository').then((m) => m.getActiveBlock()))?.id).toBe(
      'block-1',
    );
  });

  it('rejects a snapshot from a future schema version rather than silently corrupting state', async () => {
    const snapshot = await exportAll(T0);
    await expect(importAll({ ...snapshot, schemaVersion: 99 })).rejects.toThrow(/schema version/);
  });

  it('clears optional fields on import rather than writing undefined into them', async () => {
    await saveProfile(PROFILE);
    const bareSnapshot = await exportAll(T0);
    await importAll({ ...bareSnapshot, profile: undefined });
    expect(await getProfile()).toBeUndefined();
  });
});
