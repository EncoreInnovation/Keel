import { describe, expect, it } from 'vitest';
import { MAX_RECOMMENDATIONS, recommendSessions, type RecommendInput } from '../src/pillars/recommend';
import { PILLAR_GROUPS, PILLAR_SESSIONS } from '../src/pillars/library';
import { PILLAR_KINDS } from '../src/engine/types';

const base: RecommendInput = { hour: 14, pelvicDoneToday: true, trainedToday: false, realignInLastTwoDays: false };
const kinds = (i: Partial<RecommendInput>) => recommendSessions({ ...base, ...i }).map((r) => r.kind);

describe('recommendSessions', () => {
  it('puts the daily pelvic floor session first until it is done', () => {
    expect(kinds({ pelvicDoneToday: false })[0]).toBe('pelvic');
    expect(kinds({})).not.toContain('pelvic');
  });

  it('suggests Ground on a low-readiness or under-recovered day', () => {
    expect(kinds({ readiness: 2 })).toContain('ground');
    expect(kinds({ lowestRecovery: 0.3 })).toContain('ground');
    expect(kinds({ readiness: 4, lowestRecovery: 0.9 })).not.toContain('ground');
  });

  it('suggests Activate on an early morning before training only', () => {
    expect(kinds({ hour: 6 })).toContain('activate');
    expect(kinds({ hour: 6, trainedToday: true })).not.toContain('activate');
  });

  it('suggests Realign when the scan shows a tilt, unless done recently', () => {
    const r = recommendSessions({ ...base, postureTilt: 'Right hip 2° higher' });
    expect(r[0]).toEqual({ kind: 'realign', reason: 'Your last scan: Right hip 2° higher.' });
    expect(kinds({ postureTilt: 'Right hip 2° higher', realignInLastTwoDays: true })).not.toContain('realign');
  });

  it('winds down in the evening — deep rest after training, resonance otherwise', () => {
    expect(kinds({ hour: 21, trainedToday: true })).toContain('nsdr');
    expect(kinds({ hour: 21 })).toContain('resonance');
  });

  it('suggests Hip Flow after training or on a rest day once it has been 3+ days', () => {
    expect(kinds({ trainedToday: true })).toContain('hipflow');
    expect(kinds({ restDay: true, hipFlowDaysSince: 4 })).toContain('hipflow');
    expect(kinds({ trainedToday: true, hipFlowDaysSince: 1 })).not.toContain('hipflow');
    // Not on an ordinary untrained afternoon.
    expect(kinds({ hipFlowDaysSince: 5 })).not.toContain('hipflow');
    expect(recommendSessions({ ...base, trainedToday: true, hipFlowDaysSince: 4 })[0]!.reason).toContain('4 days ago');
  });

  it('never pushes the Control session on its own', () => {
    expect(kinds({ trainedToday: true, restDay: true, hour: 22 })).not.toContain('control');
  });

  it('always has something, falls back to cyclic sighing, and never exceeds the cap', () => {
    expect(kinds({})).toEqual(['sigh']);
    const busy = recommendSessions({ ...base, hour: 6, pelvicDoneToday: false, readiness: 1, postureTilt: 'x' });
    expect(busy.length).toBe(MAX_RECOMMENDATIONS);
  });
});

describe('session explanations', () => {
  it('gives every session a purpose and a when, and puts each in exactly one group', () => {
    for (const kind of PILLAR_KINDS) {
      expect(PILLAR_SESSIONS[kind].purpose.length, kind).toBeGreaterThan(10);
      expect(PILLAR_SESSIONS[kind].when.length, kind).toBeGreaterThan(10);
      expect(PILLAR_GROUPS.filter((g) => g.kinds.includes(kind)).length, kind).toBe(1);
    }
  });
});
