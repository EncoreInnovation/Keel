/**
 * The contract these tests defend: the engine may never hand back a weight
 * the user cannot physically load. Everything else here is in service of
 * that one invariant.
 */

import { describe, expect, it } from 'vitest';
import {
  achievableLoads,
  barLoads,
  canStepUp,
  loadGapRatio,
  MAX_SANE_LOAD_JUMP,
  nextLoadStep,
  previousLoadStep,
  resolveLoad,
} from '../src/engine/loading';
import type { Exercise, Gym } from '../src/engine/types';

const HOME: Gym = {
  id: 'home',
  name: 'Home',
  dumbbells: [10, 20, 30],
  dumbbellsPaired: true,
  barbell: { barWeight: 45, plates: [25, 10, 5], pairsPerPlate: [1, 2, 1] },
  ezBar: { barWeight: 25, plates: [10, 5], pairsPerPlate: [2, 2] },
  kettlebells: [35],
  equipment: ['bodyweight', 'dumbbell', 'barbell', 'ezBar', 'kettlebell', 'band', 'pullupBar', 'bench'],
};

const APARTMENT: Gym = {
  id: 'apartment',
  name: 'Apartment gym',
  dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  dumbbellsPaired: true,
  kettlebells: [25, 35, 45],
  equipment: ['bodyweight', 'dumbbell', 'kettlebell', 'cable', 'legPress', 'bench', 'pullupBar', 'medicineBall', 'battleRopes'],
};

function ex(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'test',
    name: 'Test',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    patterns: ['horizontalPush'],
    equipment: ['dumbbell'],
    loadType: 'external',
    impact: 'none',
    level: 'novice',
    unilateral: false,
    goalFit: 0.5,
    correctiveFit: 0.5,
    jointLoad: [],
    instructions: [],
    images: [],
    ...overrides,
  };
}

describe('barLoads', () => {
  it('includes the bare bar, which is often the right starting weight', () => {
    expect(barLoads({ barWeight: 45, plates: [], pairsPerPlate: [] })).toEqual([45]);
  });

  it('adds plates in pairs, so one pair of 25s adds 50 lb total', () => {
    const loads = barLoads({ barWeight: 45, plates: [25], pairsPerPlate: [1] });
    expect(loads).toEqual([45, 95]);
  });

  it('respects how many pairs are actually owned', () => {
    const one = barLoads({ barWeight: 45, plates: [10], pairsPerPlate: [1] });
    const two = barLoads({ barWeight: 45, plates: [10], pairsPerPlate: [2] });
    expect(one).toEqual([45, 65]);
    expect(two).toEqual([45, 65, 85]);
  });

  it('combines denominations without exceeding owned pairs', () => {
    const loads = barLoads(HOME.barbell!);
    expect(loads[0]).toBe(45);
    // 45 + 25*2 + 10*2*2 + 5*2 = 45+50+40+10 = 145 is the heaviest possible.
    expect(loads.at(-1)).toBe(145);
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
    expect(new Set(loads).size).toBe(loads.length);
  });
});

describe('achievableLoads', () => {
  it('returns nothing for bodyweight work, signalling the ladder is the axis', () => {
    expect(achievableLoads(ex({ loadType: 'bodyweight', equipment: ['bodyweight'] }), HOME)).toEqual([]);
  });

  it('returns nothing for band work', () => {
    expect(achievableLoads(ex({ loadType: 'band', equipment: ['band'] }), HOME)).toEqual([]);
  });

  it('gives the real home dumbbell rack, not an increment series', () => {
    expect(achievableLoads(ex({ equipment: ['dumbbell'] }), HOME)).toEqual([10, 20, 30]);
  });

  it('gives the much denser apartment rack for the same exercise', () => {
    const loads = achievableLoads(ex({ equipment: ['dumbbell'] }), APARTMENT);
    expect(loads).toContain(45);
    expect(loads.length).toBeGreaterThan(HOME.dumbbells.length);
  });

  it('refuses bilateral dumbbell work when only single dumbbells are owned', () => {
    const single: Gym = { ...HOME, dumbbellsPaired: false };
    expect(achievableLoads(ex({ unilateral: false }), single)).toEqual([]);
  });

  it('still allows unilateral dumbbell work with single dumbbells', () => {
    const single: Gym = { ...HOME, dumbbellsPaired: false };
    expect(achievableLoads(ex({ unilateral: true }), single)).toEqual([10, 20, 30]);
  });

  it('returns nothing when the gym lacks the required equipment', () => {
    expect(achievableLoads(ex({ equipment: ['barbell'] }), APARTMENT)).toEqual([]);
    expect(achievableLoads(ex({ equipment: ['cable'] }), HOME)).toEqual([]);
  });

  it('uses the EZ bar inventory for EZ bar work', () => {
    const loads = achievableLoads(ex({ equipment: ['ezBar'] }), HOME);
    expect(loads[0]).toBe(25);
  });
});

describe('resolveLoad', () => {
  const rack = [10, 20, 30];

  it('never returns a weight outside the rack', () => {
    for (const target of [0, 1, 7, 12, 18, 25, 29, 44, 500]) {
      expect(rack).toContain(resolveLoad(target, rack));
    }
  });

  it('clamps below and above the rack rather than inventing weights', () => {
    expect(resolveLoad(2, rack)).toBe(10);
    expect(resolveLoad(9999, rack)).toBe(30);
  });

  it('snaps to the nearest available weight', () => {
    expect(resolveLoad(21, rack)).toBe(20);
    expect(resolveLoad(28, rack)).toBe(30);
  });

  it('breaks an exact tie downward, because lighter is the safer prescription', () => {
    expect(resolveLoad(15, rack)).toBe(10);
    expect(resolveLoad(25, rack)).toBe(20);
  });

  it('returns 0 when nothing is loadable, rather than a fake weight', () => {
    expect(resolveLoad(50, [])).toBe(0);
  });
});

describe('stepping through real weights', () => {
  const rack = [10, 20, 30];

  it('finds the next and previous real weights', () => {
    expect(nextLoadStep(10, rack)).toBe(20);
    expect(previousLoadStep(30, rack)).toBe(20);
  });

  it('returns undefined at the ends of the rack', () => {
    expect(nextLoadStep(30, rack)).toBeUndefined();
    expect(previousLoadStep(10, rack)).toBeUndefined();
  });
});

describe('load gaps — the reason this module exists', () => {
  it('reports the brutal jump on a sparse home rack', () => {
    // 10 -> 20 is a 100% increase. No one absorbs that in one session.
    expect(loadGapRatio(10, [10, 20, 30])).toBe(1);
  });

  it('refuses to call a 100% jump a sane progression step', () => {
    expect(canStepUp(10, [10, 20, 30])).toBe(false);
  });

  it('allows stepping up on a dense rack where the jump is small', () => {
    const dense = APARTMENT.dumbbells;
    // 50 -> 55 is 10%, under the sane threshold.
    expect(canStepUp(50, dense)).toBe(true);
    expect(loadGapRatio(50, dense)!).toBeLessThanOrEqual(MAX_SANE_LOAD_JUMP);
  });

  it('reports no gap at the top of the rack', () => {
    expect(loadGapRatio(30, [10, 20, 30])).toBeUndefined();
    expect(canStepUp(30, [10, 20, 30])).toBe(false);
  });

  it('treats a zero current load as having no meaningful ratio', () => {
    expect(loadGapRatio(0, [10, 20, 30])).toBeUndefined();
  });
});

describe('the core invariant, swept broadly', () => {
  it('every resolved load across every gym and exercise shape is physically loadable', () => {
    const exercises = [
      ex({ equipment: ['dumbbell'] }),
      ex({ equipment: ['dumbbell'], unilateral: true }),
      ex({ equipment: ['barbell'] }),
      ex({ equipment: ['ezBar'] }),
      ex({ equipment: ['kettlebell'] }),
      ex({ equipment: ['cable'] }),
      ex({ equipment: ['legPress'] }),
      ex({ equipment: ['bodyweight'], loadType: 'bodyweight' }),
    ];

    for (const gym of [HOME, APARTMENT]) {
      for (const exercise of exercises) {
        const achievable = achievableLoads(exercise, gym);
        for (const target of [0, 3, 17, 42.5, 88, 137, 1000]) {
          const resolved = resolveLoad(target, achievable);
          if (achievable.length === 0) {
            expect(resolved).toBe(0);
          } else {
            expect(achievable).toContain(resolved);
          }
        }
      }
    }
  });
});
