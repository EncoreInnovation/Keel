/**
 * The four real gyms, end to end. Each one must produce sessions built only
 * from kit it actually has, at weights it can actually load — and a primary
 * locked in one gym must never leak into another that can't train it.
 */

import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/exercises';
import {
  APARTMENT_GYM,
  DEFAULT_GYMS,
  FC_NORTH_HILLS_GYM,
  HOME_GYM,
} from '../src/config/gyms';
import { createBlock, HYPERTROPHY_BLOCK_DAYS, generateSession, withGymLocks } from '../src/engine/blocks';
import { achievableLoads } from '../src/engine/loading';
import type { SelectionContext } from '../src/engine/selector';
import type { Exercise, GymId, MuscleMap, UserProfile } from '../src/engine/types';

const T0 = 1_700_000_000_000;
const catalog = CATALOG as Exercise[];

const FULL_RECOVERY = Object.fromEntries(
  ['chest', 'upperBack', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'neck'].map(
    (m) => [m, 1],
  ),
) as MuscleMap;

function profileAt(gymId: GymId): UserProfile {
  return {
    bodyweight: 292,
    level: 'intermediate',
    gyms: DEFAULT_GYMS,
    activeGymId: gymId,
    flaggedJoints: [],
    impactCeiling: 'low',
    daysPerWeek: 4,
    sessionMinutes: 45,
  };
}

function ctxAt(gymId: GymId): SelectionContext {
  return {
    recovery: FULL_RECOVERY,
    profile: profileAt(gymId),
    impactCeiling: 'low',
    recentExerciseIds: [],
    historyCounts: new Map(),
    painFlags: new Set(),
  };
}

describe('default gym inventories', () => {
  it('caps the apartment rack at the 50 lb pair it actually has', () => {
    const dumbbellPress = catalog.find((e) => e.equipment.length === 1 && e.equipment[0] === 'dumbbell' && e.loadType === 'external')!;
    const loads = achievableLoads(dumbbellPress, APARTMENT_GYM);
    expect(Math.max(...loads)).toBe(50);
  });

  it('includes the TRX straps in the apartment gym', () => {
    expect(APARTMENT_GYM.equipment).toContain('suspension');
  });

  it('gives both Fitness Connection clubs a barbell and a rack', () => {
    for (const gym of DEFAULT_GYMS.filter((g) => g.id.startsWith('fc-'))) {
      expect(gym.barbell).toBeDefined();
      expect(gym.equipment).toEqual(expect.arrayContaining(['barbell', 'squatRack', 'bench']));
    }
  });
});

describe('every gym builds sessions only from its own kit', () => {
  for (const gym of DEFAULT_GYMS) {
    it(`${gym.name}: every exercise is trainable and every weight loadable`, () => {
      const ctx = ctxAt(gym.id);
      const block = createBlock('b', 'Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctx, T0);
      const available = new Set<string>(gym.equipment);

      for (const day of HYPERTROPHY_BLOCK_DAYS) {
        const session = generateSession({
          block,
          weekNumber: 1,
          dayId: day.id,
          catalog,
          ctx,
          profile: ctx.profile,
          history: [],
          volumeMultiplier: 1,
        });
        expect(session.exercises.length).toBeGreaterThan(0);
        for (const pe of session.exercises) {
          for (const item of pe.exercise.equipment) {
            expect(available.has(item), `${pe.exercise.id} needs ${item}, absent at ${gym.name}`).toBe(true);
          }
          const achievable = achievableLoads(pe.exercise, gym);
          for (const set of pe.sets) {
            if (set.weight > 0) {
              expect(achievable, `${pe.exercise.id} at ${set.weight} lb`).toContain(set.weight);
            }
          }
        }
      }
    });
  }
});

describe('per-gym primary locks', () => {
  it('locks primaries for the gym the block was created in, and only that gym', () => {
    const block = createBlock('b', 'Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctxAt('fc-north-hills'), T0);
    expect(block.lockedAssignments['fc-north-hills']).toBeDefined();
    expect(block.lockedAssignments.home).toBeUndefined();
  });

  it('adds a second gym its own locks the first time it is trained in, keeping the first', () => {
    const block = createBlock('b', 'Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctxAt('fc-north-hills'), T0);
    const withHome = withGymLocks(block, catalog, ctxAt('home'));
    expect(withHome).not.toBe(block);
    expect(withHome.lockedAssignments.home).toBeDefined();
    expect(withHome.lockedAssignments['fc-north-hills']).toEqual(block.lockedAssignments['fc-north-hills']);
    // Already locked: no change, same object, nothing to persist.
    expect(withGymLocks(withHome, catalog, ctxAt('home'))).toBe(withHome);
  });

  it('never prescribes a barbell primary locked at FC when training at home without a rack', () => {
    const block = createBlock('b', 'Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctxAt('fc-north-hills'), T0);
    const fcLocks = Object.values(block.lockedAssignments['fc-north-hills']!);
    const homeEquipment = new Set<string>(HOME_GYM.equipment);
    const fcOnly = fcLocks
      .map((id) => catalog.find((e) => e.id === id)!)
      .filter((e) => e.equipment.some((item) => !homeEquipment.has(item)));
    // The scenario only means something if FC actually locked kit home lacks.
    expect(fcOnly.length).toBeGreaterThan(0);

    const homeCtx = ctxAt('home');
    const homeBlock = withGymLocks(block, catalog, homeCtx);
    for (const day of HYPERTROPHY_BLOCK_DAYS) {
      const session = generateSession({
        block: homeBlock,
        weekNumber: 1,
        dayId: day.id,
        catalog,
        ctx: homeCtx,
        profile: homeCtx.profile,
        history: [],
        volumeMultiplier: 1,
      });
      for (const pe of session.exercises) {
        for (const item of pe.exercise.equipment) {
          expect(homeEquipment.has(item), `${pe.exercise.id} needs ${item}`).toBe(true);
        }
      }
    }
  });

  it('falls back to a trainable pick if a stale lock points at missing kit', () => {
    // A block saved before per-gym locking, or kit removed in Settings: the
    // home lock names an FC-only exercise. The selector must not obey it.
    const fcBlock = createBlock('b', 'Block', HYPERTROPHY_BLOCK_DAYS, catalog, ctxAt(FC_NORTH_HILLS_GYM.id), T0);
    const stale = { ...fcBlock, lockedAssignments: { home: fcBlock.lockedAssignments['fc-north-hills']! } };
    const homeCtx = ctxAt('home');
    const homeEquipment = new Set<string>(HOME_GYM.equipment);
    for (const day of HYPERTROPHY_BLOCK_DAYS) {
      const session = generateSession({
        block: stale,
        weekNumber: 1,
        dayId: day.id,
        catalog,
        ctx: homeCtx,
        profile: homeCtx.profile,
        history: [],
        volumeMultiplier: 1,
      });
      for (const pe of session.exercises) {
        expect(pe.exercise.equipment.every((item) => homeEquipment.has(item)), pe.exercise.id).toBe(true);
      }
    }
  });
});
