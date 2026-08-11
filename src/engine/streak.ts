/**
 * Consistency, not any single workout's quality.
 *
 * Pure over a list of completion timestamps so it's trivial to test and has
 * no opinion about where those timestamps came from — the caller (Today)
 * supplies completed-session dates and gets back the two numbers worth
 * showing on a home screen: an unbroken-day streak and a rolling weekly
 * count. Both read straight off data already logged; nothing new to store.
 */

const DAY_MS = 86_400_000;

function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/**
 * Consecutive calendar days, most recent first, with at least one completed
 * session. A gap of exactly one day (today not yet trained) doesn't break
 * the streak — only a day with nothing logged does.
 */
export function currentStreak(completedAtTimestamps: number[], now: number): number {
  if (completedAtTimestamps.length === 0) return 0;

  const days = new Set(completedAtTimestamps.map(dayKey));
  const today = dayKey(now);

  // A streak "counts" as of today even if today has no session yet — it's
  // still alive until midnight passes with nothing logged.
  let cursor = days.has(today) ? today : today - 1;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Completed sessions within the last 7 days, inclusive of today. */
export function sessionsThisWeek(completedAtTimestamps: number[], now: number): number {
  const weekAgo = now - 7 * DAY_MS;
  return completedAtTimestamps.filter((t) => t > weekAgo && t <= now).length;
}
