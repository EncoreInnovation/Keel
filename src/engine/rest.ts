/**
 * Rest that matches what the set actually cost, not just its slot role.
 *
 * Rest length was a flat per-slot constant (150s primary, 120s secondary,
 * 75s accessory, 60s finisher — `blocks.ts`), which ignores the one thing
 * that actually determines how much recovery is needed: how hard the set
 * you just did was. A light warm-up-weight set at RPE 6 doesn't need the
 * same rest as a grinder at RPE 9.5, even in the same slot.
 */

export const MIN_REST_SECONDS = 45;
export const MAX_REST_SECONDS = 210;

/** How much one point of RPE above/below target shifts rest, as a fraction of the base. */
export const REST_RPE_SENSITIVITY = 0.15;

/**
 * The slot's base rest, nudged by how the set actually went relative to its
 * target RPE, and clamped to a sane range either way. Purely a function of
 * the numbers already being logged — no new input required from the lifter.
 */
export function adjustRestSeconds(baseRestSec: number, loggedRpe: number, targetRpe: number): number {
  const delta = loggedRpe - targetRpe;
  const factor = 1 + delta * REST_RPE_SENSITIVITY;
  const adjusted = baseRestSec * factor;
  return Math.round(Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, adjusted)));
}
