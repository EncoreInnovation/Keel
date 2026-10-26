import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { controlScore, erectionScore, INTIMACY_QUESTIONS, intimacyDue, type IntimacyLog } from '../src/engine/intimacy';
import { keelStore } from '../src/storage/db';
import { appendIntimacyLog, exportAll, getIntimacyLogs, importAll } from '../src/storage/repository';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const entry = (answers: (number | null)[], at = NOW): IntimacyLog => ({ id: `i${at}`, at, answers });

beforeEach(async () => {
  await clear(keelStore);
});

describe('private check-in scoring', () => {
  it('asks five questions', () => {
    expect(INTIMACY_QUESTIONS).toHaveLength(5);
  });

  it('scores erections 4–20 from the first four answers and control 1–5 from the last', () => {
    expect(erectionScore(entry([1, 1, 1, 1, 1]))).toBe(4);
    expect(erectionScore(entry([5, 5, 5, 5, 3]))).toBe(20);
    expect(controlScore(entry([5, 5, 5, 5, 3]))).toBe(3);
  });

  it('leaves the erection score out when a question was skipped', () => {
    expect(erectionScore(entry([4, null, null, null, null]))).toBeUndefined();
    expect(controlScore(entry([4, null, null, null, null]))).toBeUndefined();
  });

  it('comes due every 28 days', () => {
    expect(intimacyDue([], NOW)).toBe(true);
    expect(intimacyDue([entry([3, 3, 3, 3, 3], NOW - 10 * DAY)], NOW)).toBe(false);
    expect(intimacyDue([entry([3, 3, 3, 3, 3], NOW - 28 * DAY)], NOW)).toBe(true);
  });
});

describe('private check-in storage', () => {
  it('stores sorted, and round-trips through your own backup; older backups still import', async () => {
    await appendIntimacyLog(entry([3, 3, 3, 3, 3], NOW));
    await appendIntimacyLog(entry([2, 2, 2, 2, 2], NOW - 30 * DAY));
    expect((await getIntimacyLogs()).map((l) => l.answers[0])).toEqual([2, 3]);
    const snapshot = await exportAll(NOW);
    expect(snapshot.intimacyLogs).toHaveLength(2);
    await clear(keelStore);
    await importAll(snapshot);
    expect(await getIntimacyLogs()).toHaveLength(2);
    const { intimacyLogs: _omit, ...legacy } = snapshot;
    void _omit;
    await importAll(legacy);
    expect(await getIntimacyLogs()).toEqual([]);
  });
});
