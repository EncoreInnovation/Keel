/**
 * The dates worth counting down to. Seeing "70 days left in Q4" on the home
 * screen every morning is the point: the days are the budget, and a budget
 * you can see gets spent better.
 *
 * Days are whole calendar days in the phone's local time. Counting by
 * timestamps would make a daylight-saving change (or simply opening the app
 * in the evening) read one day off.
 */

const DAY_MS = 86_400_000;

export type CountdownId = 'q4' | 'birthday' | 'spring' | 'summer';

export interface Countdown {
  id: CountdownId;
  label: string;
  /** Local midnight of the target day. */
  date: number;
  /** Whole days from today; 0 means today. */
  days: number;
}

/** Spring and summer start on the equinox and solstice — close enough to fix as dates. */
const SPRING = { month: 3, day: 20 };
const SUMMER = { month: 6, day: 21 };

/** A calendar day as an integer, immune to DST and time of day. */
function dayNumber(year: number, monthIndex: number, day: number): number {
  return Math.round(Date.UTC(year, monthIndex, day) / DAY_MS);
}

function next(now: number, month: number, day: number): { date: number; days: number } {
  const today = new Date(now);
  const todayNumber = dayNumber(today.getFullYear(), today.getMonth(), today.getDate());
  let year = today.getFullYear();
  if (dayNumber(year, month - 1, day) < todayNumber) year += 1;
  return {
    date: new Date(year, month - 1, day).getTime(),
    days: dayNumber(year, month - 1, day) - todayNumber,
  };
}

export const DEFAULT_BIRTHDAY = { month: 2, day: 14 };

export function countdowns(now: number, birthday = DEFAULT_BIRTHDAY): Countdown[] {
  const list: Countdown[] = [];
  // Q4 only means something while you're in it.
  if (new Date(now).getMonth() >= 9) list.push({ id: 'q4', label: 'Q4 ends', ...next(now, 12, 31) });
  list.push({ id: 'birthday', label: 'Birthday', ...next(now, birthday.month, birthday.day) });
  list.push({ id: 'spring', label: 'Spring', ...next(now, SPRING.month, SPRING.day) });
  list.push({ id: 'summer', label: 'Summer', ...next(now, SUMMER.month, SUMMER.day) });
  return list;
}
