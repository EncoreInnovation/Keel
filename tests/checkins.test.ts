import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { physiqueDue, weighInDue } from '../src/engine/checkins';
import { keelStore } from '../src/storage/db';
import { exportAll, getPhysiqueLogs, getPhysiquePhoto, importAll, savePhysiqueLog } from '../src/storage/repository';

const DAY = 86_400_000;
const NOW = 1_760_000_000_000;

beforeEach(async () => {
  await clear(keelStore);
});

describe('check-in cadence', () => {
  it('asks for a weigh-in when nothing was logged in the last week', () => {
    expect(weighInDue([], NOW)).toBe(true);
    expect(weighInDue([{ id: 'a', at: NOW - 3 * DAY, weight: 285 }], NOW)).toBe(false);
    expect(weighInDue([{ id: 'a', at: NOW - 8 * DAY, weight: 285 }], NOW)).toBe(true);
    expect(weighInDue([{ id: 'a', at: NOW - DAY, measurements: { waist: 44 } }], NOW)).toBe(false);
  });

  it('asks for physique photos monthly', () => {
    expect(physiqueDue([], NOW)).toBe(true);
    expect(physiqueDue([{ id: 'p', at: NOW - 10 * DAY, views: ['front'] }], NOW)).toBe(false);
    expect(physiqueDue([{ id: 'p', at: NOW - 30 * DAY, views: ['front'] }], NOW)).toBe(true);
  });
});

describe('physique storage', () => {
  it('stores photos per view and keeps logs date-sorted', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await savePhysiqueLog({ id: 'late', at: NOW, views: ['back'] }, { back: blob });
    await savePhysiqueLog({ id: 'early', at: NOW - 30 * DAY, views: ['front', 'side'] }, { front: blob, side: blob });
    expect((await getPhysiqueLogs()).map((l) => l.id)).toEqual(['early', 'late']);
    expect(await getPhysiquePhoto('early', 'side')).toBeDefined();
    expect(await getPhysiquePhoto('early', 'back')).toBeUndefined();
  });

  it('round-trips physique metadata through backup, and old backups without it still import', async () => {
    await savePhysiqueLog({ id: 'p1', at: NOW, views: ['front'] }, {});
    const snapshot = await exportAll(NOW);
    expect(snapshot.physiqueLogs).toHaveLength(1);
    await clear(keelStore);
    await importAll(snapshot);
    expect(await getPhysiqueLogs()).toHaveLength(1);
    const { physiqueLogs: _omit, ...legacy } = snapshot;
    void _omit;
    await importAll(legacy);
    expect(await getPhysiqueLogs()).toEqual([]);
  });
});
