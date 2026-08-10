/**
 * Sanity checks on the pillar content library — not testing behaviour so
 * much as guarding against authoring slips (a session with zero steps, a
 * duration typo that makes the displayed minutes badly wrong).
 */

import { describe, expect, it } from 'vitest';
import { PILLAR_SESSIONS } from '../src/pillars/library';
import { PILLAR_KINDS } from '../src/engine/types';

function stepSeconds(step: (typeof PILLAR_SESSIONS)['reset']['steps'][number]): number {
  if (step.type === 'move') return step.seconds;
  return step.protocol.phases.reduce((sum, p) => sum + p.seconds, 0) * step.cycles;
}

describe('pillar library', () => {
  it('defines all four kinds', () => {
    expect(Object.keys(PILLAR_SESSIONS).sort()).toEqual([...PILLAR_KINDS].sort());
  });

  it('every session has at least one step', () => {
    for (const session of Object.values(PILLAR_SESSIONS)) {
      expect(session.steps.length).toBeGreaterThan(0);
    }
  });

  it('kind matches its own key', () => {
    for (const [key, session] of Object.entries(PILLAR_SESSIONS)) {
      expect(session.kind).toBe(key);
    }
  });

  it('displayed minutes are in the right ballpark of actual step duration', () => {
    for (const session of Object.values(PILLAR_SESSIONS)) {
      const totalSeconds = session.steps.reduce((sum, s) => sum + stepSeconds(s), 0);
      const totalMinutes = totalSeconds / 60;
      // Generous band — this is a guard against a real authoring error
      // (a zero, a missing zero), not a precision requirement.
      expect(totalMinutes).toBeGreaterThan(session.minutes * 0.4);
      expect(totalMinutes).toBeLessThan(session.minutes * 2.5);
    }
  });

  it('Ground stays close to the plan-specified 5 minutes', () => {
    const ground = PILLAR_SESSIONS.ground;
    const totalSeconds = ground.steps.reduce((sum, s) => sum + stepSeconds(s), 0);
    expect(totalSeconds).toBeGreaterThan(180);
    expect(totalSeconds).toBeLessThan(420);
  });

  it('breath steps use a positive cycle count and move steps a positive duration', () => {
    for (const session of Object.values(PILLAR_SESSIONS)) {
      for (const step of session.steps) {
        if (step.type === 'breath') expect(step.cycles).toBeGreaterThan(0);
        else expect(step.seconds).toBeGreaterThan(0);
      }
    }
  });
});
