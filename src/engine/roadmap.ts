/**
 * The Q4 plan as a calendar: two six-week blocks (build weeks 1–5, deload in
 * week 6) followed by a retest week, projected from the day the first block
 * started, with the holidays placed in whichever week they land.
 *
 * Blocks advance by sessions completed, not by calendar, so this is a
 * projection at the intended 3–4 sessions a week — it tells you where you
 * should be, and the block's own week counter tells you where you are.
 */

import { BLOCK_WEEKS } from './blocks';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export type RoadmapPhase = 'build' | 'deload' | 'retest';

export interface RoadmapWeek {
  /** 0-based position in the plan. */
  index: number;
  start: number;
  /** Exclusive. */
  end: number;
  /** 1 or 2; the retest week reports 2. */
  block: 1 | 2;
  /** 1-based week within its block; 7 for the retest week. */
  weekInBlock: number;
  phase: RoadmapPhase;
  events: string[];
}

export interface CalendarEvent {
  label: string;
  at: number;
}

/** Fourth Thursday of November, local time. */
function thanksgiving(year: number): Date {
  const first = new Date(year, 10, 1);
  const offset = (4 - first.getDay() + 7) % 7;
  return new Date(year, 10, 1 + offset + 21);
}

export function holidayEvents(year: number): CalendarEvent[] {
  return [
    { label: 'Thanksgiving', at: thanksgiving(year).getTime() },
    { label: 'Christmas', at: new Date(year, 11, 25).getTime() },
    { label: 'New Year’s Eve', at: new Date(year, 11, 31).getTime() },
  ];
}

export function buildRoadmap(firstBlockStartedAt: number): RoadmapWeek[] {
  const start = new Date(firstBlockStartedAt);
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const events = [...holidayEvents(start.getFullYear()), ...holidayEvents(start.getFullYear() + 1)];

  const weeks: RoadmapWeek[] = [];
  const total = BLOCK_WEEKS * 2 + 1;
  for (let i = 0; i < total; i += 1) {
    const wStart = t0 + i * WEEK_MS;
    const wEnd = wStart + WEEK_MS;
    const isRetest = i === total - 1;
    const block: 1 | 2 = i < BLOCK_WEEKS ? 1 : 2;
    const weekInBlock = isRetest ? BLOCK_WEEKS + 1 : (i % BLOCK_WEEKS) + 1;
    weeks.push({
      index: i,
      start: wStart,
      end: wEnd,
      block,
      weekInBlock,
      phase: isRetest ? 'retest' : weekInBlock === BLOCK_WEEKS ? 'deload' : 'build',
      events: events.filter((e) => e.at >= wStart && e.at < wEnd).map((e) => e.label),
    });
  }
  return weeks;
}

/** Index of the week containing `now`, clamped to the plan. */
export function currentWeekIndex(weeks: RoadmapWeek[], now: number): number {
  if (now < weeks[0]!.start) return 0;
  const found = weeks.findIndex((w) => now >= w.start && now < w.end);
  return found === -1 ? weeks.length - 1 : found;
}

export function daysUntil(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / DAY_MS));
}
