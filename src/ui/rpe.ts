/**
 * RPE, in plain English.
 *
 * The app asked for a number from 6 to 10 with no explanation of what any of
 * it meant — the only numeric scale in the whole app without word labels,
 * while the readiness and activation scales both had them. RPE is just "how
 * many reps did you have left", so that is what it should say.
 */

/** Short label for each whole-number RPE, phrased as reps left in the tank. */
export const RPE_HINTS: Record<number, string> = {
  6: '6 · easy, 4+ more',
  7: '7 · 3 more in me',
  8: '8 · 2 more in me',
  9: '9 · 1 more, maybe',
  10: '10 · max, 0 more',
};

/** One-line explanation shown next to the selector. */
export const RPE_EXPLAINER =
  'How hard was that? Pick how many more good reps you could have done. Not sure? Pick 8.';

/** Label for any RPE, including the halves, falling back to the number. */
export function rpeLabel(value: number): string {
  return RPE_HINTS[value] ?? String(value);
}
