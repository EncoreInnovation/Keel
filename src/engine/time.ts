/**
 * Calendar-day math shared by anything that cares about "today" vs.
 * "yesterday" rather than raw elapsed milliseconds — streaks and stale
 * session detection both need the same definition of a day boundary, so it
 * lives in one place rather than two copies quietly drifting apart.
 */

export const DAY_MS = 86_400_000;

/** An integer that's identical for every timestamp within the same UTC calendar day. */
export function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

export function isSameCalendarDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}
