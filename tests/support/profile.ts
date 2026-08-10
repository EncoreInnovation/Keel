/**
 * Shared test fixtures.
 *
 * One definition of a valid profile so a change to the profile shape breaks
 * in one place rather than four, and so tests that don't care about equipment
 * don't have to spell out an entire gym inventory to say something about
 * progression.
 */

import type { Gym, UserProfile } from '../../src/engine/types';

/**
 * A deliberately dense rack — 5 lb steps all the way up. Tests about
 * progression logic use this so the "next weight" is always a sane step and
 * the sparse-rack behaviour doesn't quietly interfere with what they assert.
 */
export const DENSE_LOADS: number[] = Array.from({ length: 40 }, (_, i) => (i + 1) * 5);

/** The real home rack: three fixed pairs with brutal gaps between them. */
export const SPARSE_LOADS: number[] = [10, 20, 30];

export const TEST_GYM: Gym = {
  id: 'home',
  name: 'Test gym',
  dumbbells: DENSE_LOADS,
  dumbbellsPaired: true,
  barbell: { barWeight: 45, plates: [25, 10, 5], pairsPerPlate: [2, 4, 2] },
  ezBar: { barWeight: 25, plates: [10, 5], pairsPerPlate: [2, 2] },
  kettlebells: [35, 53],
  equipment: [
    'bodyweight',
    'dumbbell',
    'barbell',
    'ezBar',
    'kettlebell',
    'band',
    'mat',
    'bench',
    'pullupBar',
    'wall',
    'chair',
    'suspension',
    'abRoller',
  ],
};

export function testProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    bodyweight: 292,
    level: 'novice',
    gyms: [TEST_GYM],
    activeGymId: 'home',
    flaggedJoints: [],
    impactCeiling: 'low',
    daysPerWeek: 5,
    sessionMinutes: 45,
    ...overrides,
  };
}
