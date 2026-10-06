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
  // From photos of the actual room: a fixed rack topping out at 50, a dual
  // adjustable functional trainer (cables, rope and straight-bar attachments,
  // pull-up bar on top), adjustable bench, seated leg press, TRX straps,
  // kettlebells, medicine/slam balls, battle ropes. No barbell, plates, rack,
  // or dedicated pulldown/row/leg-curl stations — the cable trainer covers
  // those patterns. Cardio (treadmills, ellipticals, bike) is logged as
  // conditioning, not prescribed here.
  dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
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
    'suspension',
    'medicineBall',
    'battleRopes',
    'mat',
    'wall',
    'chair',
  ],
};

/**
 * A standard Fitness Connection floor. Publicly confirmed for both clubs: a
 * functional training rig with Olympic bars and bumper plates, heavy bags, a
 * turf area with tire flips, battle ropes and plyo boxes, and a full cardio
 * theater (treadmills, ellipticals, bikes, stair climbers).
 *
 * The rest is the typical big-box layout, NOT confirmed per club — dumbbell
 * range, kettlebell sizes, machine line-up, Smith machine. Verify in person and
 * correct in Settings; a prescription for kit that isn't there is the one
 * failure this inventory exists to prevent. No sled until one is confirmed.
 * A bench or plyo box stands in wherever the catalog asks for a chair.
 */
const FC_STANDARD: Omit<Gym, 'id' | 'name'> = {
  dumbbells: Array.from({ length: 20 }, (_, i) => (i + 1) * 5), // 5–100
  dumbbellsPaired: true,
  barbell: { barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5], pairsPerPlate: [4, 2, 2, 2, 2, 2] },
  ezBar: { barWeight: 25, plates: [25, 10, 5, 2.5], pairsPerPlate: [2, 2, 2, 2] },
  kettlebells: [15, 20, 25, 30, 35, 40, 45, 53, 62, 70],
  equipment: [
    'bodyweight',
    'dumbbell',
    'barbell',
    'ezBar',
    'kettlebell',
    'cable',
    'legPress',
    'bench',
    'pullupBar',
    'squatRack',
    'smithMachine',
    'machine',
    'plyoBox',
    'medicineBall',
    'battleRopes',
    'punchingBag',
    'mat',
    'wall',
    'chair',
  ],
};

/** Fitness Connection North Hills, Raleigh — the home club. */
export const FC_NORTH_HILLS_GYM: Gym = { id: 'fc-north-hills', name: 'FC North Hills', ...FC_STANDARD };

/** Fitness Connection RTP, 4700 Emperor Blvd, Durham — the one near RDU. */
export const FC_RTP_GYM: Gym = { id: 'fc-rtp', name: 'FC RTP', ...FC_STANDARD };

export const DEFAULT_GYMS: Gym[] = [HOME_GYM, APARTMENT_GYM, FC_NORTH_HILLS_GYM, FC_RTP_GYM];
