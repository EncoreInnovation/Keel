import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { keelStore } from '../src/storage/db';
import {
  deleteProgramLog,
  exportAll,
  getConditioningLogs,
  getProgramLogs,
  importAll,
  saveProgramLog,
} from '../src/storage/repository';
import type { DDLog } from '../src/programs/digDeeper';
import type { ConditioningLog } from '../src/engine/types';

const NOW = 1_800_000_000_000;
const ddLog: DDLog = { id: 'd1', date: '2026-10-26', type: 'completed', slotId: 'w1d1', performedWorkoutId: 'dc1', createdAt: NOW };
const fatigue: ConditioningLog = { id: 'x', kind: 'dig-deeper', startedAt: NOW, durationSec: 2700, effort: 7, impact: 'low', source: 'manual', muscles: { chest: 0.5 } };

beforeEach(async () => {
  await clear(keelStore);
});

describe('Dig Deeper logs', () => {
  it('saves the workout and its fatigue entry together, and deletes both', async () => {
    await saveProgramLog(ddLog, fatigue);
    expect(await getProgramLogs()).toHaveLength(1);
    expect((await getConditioningLogs()).map((c) => c.id)).toEqual(['dd-d1']);
    // Saving the same log again replaces rather than duplicates.
    await saveProgramLog({ ...ddLog, effort: 8 }, fatigue);
    expect(await getProgramLogs()).toHaveLength(1);
    expect(await getConditioningLogs()).toHaveLength(1);
    await deleteProgramLog('d1');
    expect(await getProgramLogs()).toEqual([]);
    expect(await getConditioningLogs()).toEqual([]);
  });

  it('round-trips through backup, and older backups without it still import', async () => {
    await saveProgramLog(ddLog, fatigue);
    const snapshot = await exportAll(NOW);
    expect(snapshot.programLogs).toHaveLength(1);
    await clear(keelStore);
    await importAll(snapshot);
    expect(await getProgramLogs()).toHaveLength(1);
    const { programLogs: _omit, ...legacy } = snapshot;
    void _omit;
    await importAll(legacy);
    expect(await getProgramLogs()).toEqual([]);
  });
});
