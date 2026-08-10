/**
 * The two places training actually happens.
 *
 * These are seeded defaults, not fixed truth — Settings edits them and the
 * edits persist. They live here rather than inline in Setup so the engine
 * tests, the setup flow, and the settings editor all reason about the same
 * inventory instead of three drifting copies.
 *
 * The plate counts matter more than they look. `pairsPerPlate` is PAIRS, not
 * individual plates: 2×25 lb plates is one pair, and 6×10 lb plates is three
 * pairs. Getting that wrong would silently double every barbell prescription.
 */

import type { Gym } from '../engine/types';

/** 2×25 and 6×10 — one pair of 25s, three pairs of 10s. Shared across both bars. */
const HOME_PLATES = { plates: [25, 10], pairsPerPlate: [1, 3] };

export const HOME_GYM: Gym = {
  id: 'home',
  name: 'Home',
  dumbbells: [10, 20, 30],
  dumbbellsPaired: true,
  barbell: { barWeight: 45, ...HOME_PLATES },
  ezBar: { barWeight: 25, ...HOME_PLATES },
  kettlebells: [],
  equipment: [
    'bodyweight',
    'dumbbell',
    'barbell',
    'ezBar',
    'band',
    'suspension',
    'pullupBar',
    'abRoller',
    'punchingBag',
    'mat',
    'wall',
    'chair',
  ],
};

export const APARTMENT_GYM: Gym = {
  id: 'apartment',
  name: 'Apartment gym',
  // A real rack — the whole point of training here is that load stops being
  // the bottleneck, so progression can run on weight instead of reps.
  dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
  dumbbellsPaired: true,
  kettlebells: [25, 35, 45],
  equipment: [
    'bodyweight',
    'dumbbell',
    'kettlebell',
    'cable',
    'legPress',
    'bench',
    'pullupBar',
    'medicineBall',
    'battleRopes',
    'mat',
    'wall',
    'chair',
  ],
};

export const DEFAULT_GYMS: Gym[] = [HOME_GYM, APARTMENT_GYM];
