/**
 * What weight can you actually pick up?
 *
 * Every other module in the engine reasons about load as a continuous number
 * — e1RM math, percentage targets, autoregulation multipliers all produce
 * arbitrary decimals. This module is the boundary where that fiction meets a
 * rack of fixed dumbbells. Nothing outside here should ever hand the user a
 * weight; it should compute a target and pass it through `resolveLoad` first.
 *
 * The distinction that matters: a 20 lb dumbbell pair is not "20 lb plus an
 * increment away" from a 30 lb pair. There is nothing in between. When the
 * next rung is a 50% jump, the correct move is almost never to take it — it
 * is to add reps, slow the tempo, or climb the exercise ladder instead. The
 * engine can only make that judgement if it knows the real gaps, which is
 * what `nextLoadStep` and `loadGapRatio` expose.
 */

import type { BarInventory, Exercise, Gym } from './types';

/** Sorted ascending, de-duplicated, positives only. */
function normalize(values: number[]): number[] {
  return [...new Set(values.filter((v) => v > 0))].sort((a, b) => a - b);
}

/**
 * Every total weight this bar can be loaded to, given the plates owned.
 *
 * Plates load in pairs (one per side) to keep the bar balanced, so each pair
 * of a denomination adds twice its value. The bare bar counts as a valid
 * load — for many people it is the correct starting weight.
 */
export function barLoads(bar: BarInventory): number[] {
  const totals = new Set<number>([bar.barWeight]);

  // Breadth-first over plate denominations, tracking how many pairs of each
  // have been used so we never exceed what's owned.
  let frontier: { total: number; index: number }[] = [{ total: bar.barWeight, index: 0 }];

  for (let i = 0; i < bar.plates.length; i += 1) {
    const denom = bar.plates[i]!;
    const pairs = bar.pairsPerPlate[i] ?? 0;
    const next: { total: number; index: number }[] = [];

    for (const node of frontier) {
      for (let used = 0; used <= pairs; used += 1) {
        const total = node.total + used * denom * 2;
        totals.add(total);
        next.push({ total, index: i + 1 });
      }
    }
    frontier = next;
  }

  return normalize([...totals]);
}

/**
 * The discrete weights available for a given exercise in a given gym.
 *
 * Returns an empty array for anything not externally loaded (bodyweight,
 * band, and timed work), which is the signal to callers that load is not the
 * progression axis for this movement — the ladder is.
 */
export function achievableLoads(exercise: Exercise, gym: Gym): number[] {
  if (exercise.loadType !== 'external') return [];

  const uses = (e: string) => exercise.equipment.includes(e as never);

  // A cable stack or a leg press is effectively continuous at the resolution
  // that matters here, so it is modelled as a fine ladder rather than a
  // special case that would force every caller to branch.
  if (uses('cable') && gym.equipment.includes('cable')) {
    return normalize(Array.from({ length: 40 }, (_, i) => (i + 1) * 5));
  }
  if (uses('legPress') && gym.equipment.includes('legPress')) {
    return normalize(Array.from({ length: 40 }, (_, i) => (i + 1) * 10));
  }

  if (uses('barbell') && gym.barbell) return barLoads(gym.barbell);
  if (uses('ezBar') && gym.ezBar) return barLoads(gym.ezBar);
  if (uses('kettlebell')) return normalize(gym.kettlebells);

  if (uses('dumbbell')) {
    // Unilateral work uses one bell, so a single-dumbbell gym still supports
    // it. Bilateral dumbbell work needs pairs.
    if (!gym.dumbbellsPaired && !exercise.unilateral) return [];
    return normalize(gym.dumbbells);
  }

  return [];
}

/**
 * Snap a computed target to the nearest weight that actually exists.
 *
 * Ties break downward: when a target sits exactly between two loads, the
 * lighter one is the safer prescription, and the autoregulation loop will
 * raise it next session if it was too easy.
 */
export function resolveLoad(target: number, achievable: number[]): number {
  if (achievable.length === 0) return 0;
  if (target <= achievable[0]!) return achievable[0]!;
  if (target >= achievable.at(-1)!) return achievable.at(-1)!;

  let best = achievable[0]!;
  let bestDistance = Infinity;
  for (const load of achievable) {
    const distance = Math.abs(load - target);
    // `<` rather than `<=` keeps the lighter option on an exact tie, since
    // the list is ascending and the lighter one is seen first.
    if (distance < bestDistance) {
      best = load;
      bestDistance = distance;
    }
  }
  return best;
}

/** The next real weight up, or undefined at the top of the rack. */
export function nextLoadStep(current: number, achievable: number[]): number | undefined {
  return achievable.find((load) => load > current);
}

/** The next real weight down, or undefined at the bottom. */
export function previousLoadStep(current: number, achievable: number[]): number | undefined {
  return [...achievable].reverse().find((load) => load < current);
}

/**
 * How big the next jump is, as a fraction of the current load.
 *
 * This is the number that decides whether adding weight is even sane. On a
 * 10 lb dumbbell pair the next step is +100%; no lifter absorbs that in one
 * session. Callers use this to prefer reps or a ladder rung instead.
 */
export function loadGapRatio(current: number, achievable: number[]): number | undefined {
  if (current <= 0) return undefined;
  const next = nextLoadStep(current, achievable);
  if (next === undefined) return undefined;
  return (next - current) / current;
}

/**
 * Above this, jumping to the next weight is too violent to prescribe as a
 * normal progression step. 15% is roughly the largest single-session load
 * increase that reliably keeps technique intact.
 */
export const MAX_SANE_LOAD_JUMP = 0.15;

/** True when the next weight up is a reasonable ask rather than a cliff. */
export function canStepUp(current: number, achievable: number[]): boolean {
  const gap = loadGapRatio(current, achievable);
  return gap !== undefined && gap <= MAX_SANE_LOAD_JUMP;
}
