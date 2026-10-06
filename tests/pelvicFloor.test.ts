import { describe, expect, it } from 'vitest';
import { PELVIC_SESSIONS_PER_LEVEL, pelvicFloorSession, pelvicLevel } from '../src/pillars/pelvicFloor';
import { PILLAR_SESSIONS } from '../src/pillars/library';

function holdSeconds(completed: number): number {
  const step = pelvicFloorSession(completed).steps.find((s) => s.type === 'breath' && s.protocol.name.endsWith('s holds'));
  if (!step || step.type !== 'breath') throw new Error('no hold step');
  return step.protocol.phases[0]!.seconds;
}

function sessionSeconds(completed: number): number {
  return pelvicFloorSession(completed).steps.reduce(
    (sum, s) => sum + (s.type === 'move' ? s.seconds : s.protocol.phases.reduce((a, p) => a + p.seconds, 0) * s.cycles),
    0,
  );
}

describe('pelvic floor progression', () => {
  it('starts at 5-second holds and lengthens them with practice', () => {
    expect(holdSeconds(0)).toBe(5);
    expect(holdSeconds(PELVIC_SESSIONS_PER_LEVEL)).toBeGreaterThan(5);
    expect(holdSeconds(3 * PELVIC_SESSIONS_PER_LEVEL)).toBe(10);
  });

  it('never goes past 10-second holds, however long you practise', () => {
    expect(holdSeconds(10_000)).toBe(10);
    expect(pelvicLevel(10_000)).toBe(pelvicLevel(3 * PELVIC_SESSIONS_PER_LEVEL));
  });

  it('trains relaxation as well as contraction, and stays a short daily session', () => {
    const names = pelvicFloorSession(0).steps.filter((s) => s.type === 'breath').map((s) => (s.type === 'breath' ? s.protocol.name : ''));
    expect(names).toContain('Reverse Kegel');
    expect(names).toContain('Pelvic breath');
    expect(sessionSeconds(0) / 60).toBeLessThan(8);
    expect(sessionSeconds(10_000) / 60).toBeLessThan(10);
  });

  it('is listed in the pillar library for the Today chip', () => {
    expect(PILLAR_SESSIONS.pelvic.kind).toBe('pelvic');
  });
});
