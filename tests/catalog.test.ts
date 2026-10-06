/**
 * Catalog integrity and plyometric gating. A mistagged entry fails quietly —
 * it skews selection for weeks — so the invariants are checked here instead.
 */

import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/exercises';
import { DEFAULT_GYMS, HOME_GYM } from '../src/config/gyms';
import { createBlock, generateSession, HYBRID_BLOCK_DAYS } from '../src/engine/blocks';
import { impactAtOrBelow } from '../src/engine/recovery';
import { rankCandidates, type SelectionContext } from '../src/engine/selector';
import { EQUIPMENT, MOVEMENT_PATTERNS, type Exercise, type GymId, type ImpactLevel, type MuscleMap } from '../src/engine/types';

const catalog = CATALOG as Exercise[];
const T0 = 1_700_000_000_000;

function ctxAt(gymId: GymId, impactCeiling: ImpactLevel): SelectionContext {
  return {
    recovery: Object.fromEntries(
      ['chest', 'upperBack', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'neck'].map((m) => [m, 1]),
    ) as MuscleMap,
    profile: {
      bodyweight: 285, level: 'novice', gyms: DEFAULT_GYMS, activeGymId: gymId, flaggedJoints: [], impactCeiling: 'high', daysPerWeek: 4, sessionMinutes: 45,
    },
    impactCeiling,
    recentExerciseIds: [],
    historyCounts: new Map(),
    painFlags: new Set(),
  };
}

describe('catalog integrity', () => {
  it('has unique ids', () => {
    const ids = catalog.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every exercise a real-looking, unique technique video', () => {
    const urls = catalog.map((e) => e.videoUrl);
    for (const e of catalog) {
      expect(e.videoUrl, `${e.id} has no video`).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    }
    expect(new Set(urls).size, 'a video is reused across exercises').toBe(urls.length);
  });

  it('uses only known patterns and equipment, and ladder edges point at real exercises', () => {
    const ids = new Set(catalog.map((e) => e.id));
    for (const e of catalog) {
      for (const p of e.patterns) expect(MOVEMENT_PATTERNS).toContain(p);
      for (const q of e.equipment) expect(EQUIPMENT).toContain(q);
      if (e.progressionOf) expect(ids.has(e.progressionOf), `${e.id} -> ${e.progressionOf}`).toBe(true);
      expect(e.instructions.length, `${e.id} instructions`).toBeGreaterThanOrEqual(3);
      expect(e.breathCue, `${e.id} breath cue`).toBeTruthy();
    }
  });
});

describe('plyometric gating', () => {
  const powerSlot = HYBRID_BLOCK_DAYS.find((d) => d.id === 'athletic')!.slots.find((s) => s.pattern === 'power')!;

  for (const ceiling of ['none', 'low', 'moderate', 'high'] as const) {
    it(`never offers power work above a "${ceiling}" impact ceiling`, () => {
      for (const gym of DEFAULT_GYMS) {
        for (const r of rankCandidates(catalog, powerSlot, ctxAt(gym.id, ceiling))) {
          expect(impactAtOrBelow(r.exercise.impact, ceiling), `${r.exercise.id} at ${gym.name}`).toBe(true);
        }
      }
    });
  }

  it('still has a no-impact power option in every gym, so week 1 is not empty', () => {
    for (const gym of DEFAULT_GYMS) {
      expect(rankCandidates(catalog, powerSlot, ctxAt(gym.id, 'none')).length, gym.name).toBeGreaterThan(0);
    }
  });

  it('builds the athletic day at home in week 1 with power work first', () => {
    const ctx = ctxAt(HOME_GYM.id, 'none');
    const block = createBlock('b', 'Block', HYBRID_BLOCK_DAYS, catalog, ctx, T0);
    const session = generateSession({
      block, weekNumber: 1, dayId: 'athletic', catalog, ctx, profile: ctx.profile, history: [], volumeMultiplier: 1,
    });
    expect(session.exercises[0]!.exercise.patterns).toContain('power');
    expect(session.exercises[0]!.exercise.impact).toBe('none');
  });
});
