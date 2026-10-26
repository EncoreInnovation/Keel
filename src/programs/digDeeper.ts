/**
 * Shaun T's DIG DEEPER, as a schedule COLOSSUS can run.
 *
 * Twelve weeks in three collections — Dynamic Circuits (1–4), Sculpt &
 * Define (5–8), The Build (9–12) — five lifting days a week (days 1–5), an
 * optional Steady State Cardio on day 6, and a rest day. Taken from BODi's
 * official 12-week calendar; the scheduling rules are the same ones the
 * DIG DEEPER Central page uses, so the two never disagree about what's next.
 *
 * Workouts advance by logs, not by the calendar: a missed day pushes the
 * next workout back one training day instead of stacking two on one day.
 * Completed, substituted and skipped workouts all use up their slot; rest
 * days don't.
 *
 * The videos and their exercise lists are BODi's, so nothing here lists
 * exercises — the muscle map for each workout comes from its title alone,
 * which is all the recovery model needs.
 */

import type { MuscleMap, SetLog } from '../engine/types';
import { holidayEvents } from '../engine/roadmap';

export type DDCollection = 'dc' | 'sd' | 'tb' | 'ne';
export type DDKind = 'lifting' | 'cardio' | 'short';

export interface DDWorkout {
  id: string;
  collection: DDCollection;
  title: string;
  kind: DDKind;
  /** Rough video length, minutes. */
  minutes: number;
  /** Per-minute muscle stimulus for the recovery model, from the title. */
  muscles: Partial<MuscleMap>;
}

export const COLLECTIONS: Record<DDCollection, { name: string; weeks: string }> = {
  dc: { name: 'Dynamic Circuits', weeks: 'Weeks 1–4 · fast circuits, moderate weight' },
  sd: { name: 'Sculpt & Define', weeks: 'Weeks 5–8 · time under tension' },
  tb: { name: 'The Build', weeks: 'Weeks 9–12 · heavier, one muscle group a day' },
  ne: { name: 'No Excuses', weeks: 'Under 25 min · the short-on-time swap' },
};

/* Per-minute stimulus by focus — sized so a 45-minute session at effort 6
   takes its target muscles most of the way to a full day's fatigue. */
const FOCUS = {
  upper: { chest: 0.45, upperBack: 0.45, lats: 0.4, shoulders: 0.45, biceps: 0.35, triceps: 0.35, abs: 0.15 },
  lower: { quads: 0.7, glutes: 0.7, hamstrings: 0.55, calves: 0.3, adductors: 0.3, abs: 0.15 },
  total: {
    quads: 0.35,
    glutes: 0.35,
    hamstrings: 0.25,
    chest: 0.3,
    upperBack: 0.3,
    lats: 0.25,
    shoulders: 0.3,
    abs: 0.25,
    biceps: 0.15,
    triceps: 0.15,
  },
  chestBack: { chest: 0.75, upperBack: 0.7, lats: 0.7, biceps: 0.2, triceps: 0.2, shoulders: 0.2 },
  legs: { quads: 0.8, glutes: 0.75, hamstrings: 0.65, calves: 0.35, adductors: 0.35, lowerBack: 0.15 },
  shouldersGlutesAbs: { shoulders: 0.7, glutes: 0.6, abs: 0.55, triceps: 0.15 },
  arms: { biceps: 0.75, triceps: 0.75, forearms: 0.35, shoulders: 0.15 },
  chest: { chest: 0.9, triceps: 0.35, shoulders: 0.3 },
  backAbs: { upperBack: 0.8, lats: 0.8, biceps: 0.3, abs: 0.5, lowerBack: 0.2 },
  shouldersAbs: { shoulders: 0.8, abs: 0.55, triceps: 0.2, upperBack: 0.15 },
  glutesAbs: { glutes: 0.7, abs: 0.55, hamstrings: 0.25 },
  shouldersArms: { shoulders: 0.6, biceps: 0.55, triceps: 0.55 },
  cardio: { quads: 0.25, glutes: 0.2, calves: 0.25, hamstrings: 0.1 },
} satisfies Record<string, Partial<MuscleMap>>;

const w = (id: string, collection: DDCollection, title: string, kind: DDKind, minutes: number, muscles: Partial<MuscleMap>): DDWorkout => ({
  id,
  collection,
  title,
  kind,
  minutes,
  muscles,
});

export const DD_WORKOUTS: DDWorkout[] = [
  w('dc1', 'dc', 'Upper Body Circuit 1', 'lifting', 47, FOCUS.upper),
  w('dc2', 'dc', 'Lower Body Circuit 1', 'lifting', 45, FOCUS.lower),
  w('dc3', 'dc', 'Total Body Circuit', 'lifting', 47, FOCUS.total),
  w('dc4', 'dc', 'Upper Body Circuit 2', 'lifting', 50, FOCUS.upper),
  w('dc5', 'dc', 'Lower Body Circuit 2', 'lifting', 45, FOCUS.lower),
  w('dc6', 'dc', 'Steady State Cardio 1', 'cardio', 25, FOCUS.cardio),
  w('sd1', 'sd', 'Total Body', 'lifting', 52, FOCUS.total),
  w('sd2', 'sd', 'Chest & Back', 'lifting', 46, FOCUS.chestBack),
  w('sd3', 'sd', 'Legs', 'lifting', 40, FOCUS.legs),
  w('sd4', 'sd', 'Shoulders, Glutes & Abs', 'lifting', 48, FOCUS.shouldersGlutesAbs),
  w('sd5', 'sd', 'Bis & Tris', 'lifting', 42, FOCUS.arms),
  w('sd6', 'sd', 'Steady State Cardio 2', 'cardio', 29, FOCUS.cardio),
  w('tb1', 'tb', 'Chest', 'lifting', 40, FOCUS.chest),
  w('tb2', 'tb', 'Back & Abs', 'lifting', 45, FOCUS.backAbs),
  w('tb3', 'tb', 'Arms', 'lifting', 39, FOCUS.arms),
  w('tb4', 'tb', 'Legs', 'lifting', 39, FOCUS.legs),
  w('tb5', 'tb', 'Shoulders & Abs', 'lifting', 37, FOCUS.shouldersAbs),
  w('tb6', 'tb', 'Steady State Cardio 3', 'cardio', 32, FOCUS.cardio),
  w('ne1', 'ne', 'No Excuses Chest & Back', 'short', 24, FOCUS.chestBack),
  w('ne2', 'ne', 'No Excuses Legs', 'short', 23, FOCUS.legs),
  w('ne3', 'ne', 'No Excuses Shoulders, Bis & Tris', 'short', 24, FOCUS.shouldersArms),
  w('ne4', 'ne', 'No Excuses Glutes & Abs', 'short', 21, FOCUS.glutesAbs),
  w('ne5', 'ne', 'No Excuses Total Body', 'short', 23, FOCUS.total),
];

export const DD_BY_ID = new Map(DD_WORKOUTS.map((x) => [x.id, x]));

export const DD_WEEKS = 12;
export const DD_DAYS_PER_WEEK = 6;
/** Your DIG DEEPER Central page — where the videos are. */
export const DD_CENTRAL_URL = 'https://claude.ai/artifact/WDxMb65VkDZjmfWZMuD3rJ';
export const BODI_URL = 'https://www.bodi.com';

export function collectionForWeek(week: number): DDCollection {
  return week <= 4 ? 'dc' : week <= 8 ? 'sd' : 'tb';
}

/**
 * The No Excuses workouts closest to a scheduled one, best first — BODi's
 * rule for a short day is to pick the one that matches what you're missing.
 * Closeness is the overlap of the two muscle maps.
 */
export function noExcusesFor(workoutId: string): DDWorkout[] {
  const target = DD_BY_ID.get(workoutId);
  const shorts = DD_WORKOUTS.filter((x) => x.collection === 'ne');
  if (!target || target.kind === 'cardio') return [];
  const vec = (m: Partial<MuscleMap>) => m as Record<string, number>;
  const cosine = (a: Partial<MuscleMap>, b: Partial<MuscleMap>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const k of keys) {
      const x = vec(a)[k] ?? 0;
      const y = vec(b)[k] ?? 0;
      dot += x * y;
      na += x * x;
      nb += y * y;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  };
  return [...shorts].sort((a, b) => cosine(target.muscles, b.muscles) - cosine(target.muscles, a.muscles));
}

/* ------------------------------------------------------------------ *
 * Calendar dates as YYYY-MM-DD strings, local time
 * ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const dow = (s: string) => parseYmd(s).getDay();
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(...ymdParts(b)) - Date.UTC(...ymdParts(a))) / 86_400_000);
function ymdParts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y!, m! - 1, d!];
}

/* ------------------------------------------------------------------ *
 * Schedule
 * ------------------------------------------------------------------ */

export interface DDSlot {
  id: string;
  week: number;
  /** 1–5 lifting, 6 the optional cardio. */
  day: number;
  workoutId: string;
  optional: boolean;
}

export type DDLogType = 'completed' | 'substitute' | 'skipped' | 'rest';

export interface DDExerciseRow {
  exercise: string;
  weight?: number;
  reps?: number;
  sets?: number;
  side?: 'both' | 'left' | 'right';
}

export interface DDLog {
  id: string;
  /** Local date trained, YYYY-MM-DD. */
  date: string;
  type: DDLogType;
  slotId?: string;
  scheduledWorkoutId?: string;
  /** What was actually done — differs from the scheduled one for a substitute. */
  performedWorkoutId?: string;
  durationMin?: number;
  effort?: number;
  rows?: DDExerciseRow[];
  painNotes?: string;
  notes?: string;
  createdAt: number;
}

export interface DDSettings {
  startDate: string;
  trainingDays: number[];
  includeCardio: boolean;
}

export function buildSlots(includeCardio: boolean): DDSlot[] {
  const out: DDSlot[] = [];
  for (let week = 1; week <= DD_WEEKS; week += 1) {
    const c = collectionForWeek(week);
    for (let day = 1; day <= DD_DAYS_PER_WEEK; day += 1) {
      if (day === 6 && !includeCardio) continue;
      out.push({ id: `w${week}d${day}`, week, day, workoutId: `${c}${day}`, optional: day === 6 });
    }
  }
  return out;
}

const CONSUMES: DDLogType[] = ['completed', 'substitute', 'skipped'];

export interface DDPlan {
  slots: DDSlot[];
  remaining: DDSlot[];
  next?: DDSlot;
  /** Upcoming slots placed on training days, starting today (or tomorrow if today is logged). */
  projection: { date: string; slot: DDSlot }[];
  /** Today's scheduled slot, when today is a training day with something due and nothing logged. */
  today?: DDSlot;
  loggedToday: DDLog[];
  done: number;
  total: number;
  officialFinish: string;
  projectedFinish?: string;
  /** Days later than the official finish; 0 when on schedule. */
  daysBehind: number;
  /** Sessions done ÷ training days elapsed, 0–100; undefined before the start. */
  consistency?: number;
  complete: boolean;
  /** Week (1–12) of the next workout, or 12 when complete. */
  week: number;
}

export function computeDDPlan(settings: DDSettings, logs: DDLog[], today: string): DDPlan {
  const slots = buildSlots(settings.includeCardio);
  const days = [...settings.trainingDays].sort();
  const consumed = new Set(logs.filter((l) => l.slotId && CONSUMES.includes(l.type)).map((l) => l.slotId!));
  const remaining = slots.filter((s) => !consumed.has(s.id));
  const loggedToday = logs.filter((l) => l.date === today);

  let cursor = settings.startDate > today ? settings.startDate : loggedToday.length ? addDays(today, 1) : today;
  const projection: DDPlan['projection'] = [];
  if (days.length) {
    let i = 0;
    for (let guard = 0; i < remaining.length && guard < 5000; guard += 1) {
      if (days.includes(dow(cursor))) {
        projection.push({ date: cursor, slot: remaining[i]! });
        i += 1;
      }
      cursor = addDays(cursor, 1);
    }
  }

  // The official calendar is 12 weeks of 7 days from the start, ending on day 6
  // of week 12 (or day 5 without the optional cardio).
  const officialFinish = addDays(settings.startDate, (DD_WEEKS - 1) * 7 + (settings.includeCardio ? 5 : 4));
  let projectedFinish = projection.at(-1)?.date;
  if (!remaining.length) projectedFinish = logs.filter((l) => l.slotId).map((l) => l.date).sort().at(-1);

  let elapsed = 0;
  if (settings.startDate <= today && days.length) {
    for (let d = settings.startDate; d < today; d = addDays(d, 1)) if (days.includes(dow(d))) elapsed += 1;
    if (loggedToday.length) elapsed += 1;
  }
  const sessions = logs.filter((l) => (l.type === 'completed' || l.type === 'substitute') && l.date >= settings.startDate).length;

  const first = projection[0];
  return {
    slots,
    remaining,
    next: remaining[0],
    projection,
    today: first && first.date === today && !loggedToday.length ? first.slot : undefined,
    loggedToday,
    done: slots.length - remaining.length,
    total: slots.length,
    officialFinish,
    projectedFinish,
    daysBehind: projectedFinish && projectedFinish > officialFinish ? daysBetween(officialFinish, projectedFinish) : 0,
    consistency: elapsed ? Math.min(100, Math.round((sessions / elapsed) * 100)) : undefined,
    complete: remaining.length === 0,
    week: remaining[0]?.week ?? DD_WEEKS,
  };
}

/** True while the program is set to Dig Deeper and has workouts left. */
export function ddActive(program: { kind: string } | undefined, plan: DDPlan | undefined): boolean {
  return program?.kind === 'dig-deeper' && Boolean(plan && !plan.complete);
}

/* ------------------------------------------------------------------ *
 * Roadmap — the 12 calendar weeks, coloured by collection
 * ------------------------------------------------------------------ */

export interface DDRoadmapWeek {
  index: number;
  week: number;
  start: string;
  /** Last day of the week, inclusive. */
  end: string;
  collection: DDCollection;
  events: string[];
}

export function ddRoadmap(startDate: string): DDRoadmapWeek[] {
  const year = parseYmd(startDate).getFullYear();
  const events = [...holidayEvents(year), ...holidayEvents(year + 1)].map((e) => ({ label: e.label, date: ymd(new Date(e.at)) }));
  return Array.from({ length: DD_WEEKS }, (_, i) => {
    const start = addDays(startDate, i * 7);
    const end = addDays(start, 6);
    return {
      index: i,
      week: i + 1,
      start,
      end,
      collection: collectionForWeek(i + 1),
      events: events.filter((e) => e.date >= start && e.date <= end).map((e) => e.label),
    };
  });
}

/** Default program for a new or upgraded profile: started Mon Oct 26 2026, Mon–Sat. */
export const DEFAULT_DD_SETTINGS: DDSettings = {
  startDate: '2026-10-26',
  trainingDays: [1, 2, 3, 4, 5, 6],
  includeCardio: true,
};

/* ------------------------------------------------------------------ *
 * Weights logged in Dig Deeper, for Progress and Left/right balance
 * ------------------------------------------------------------------ */

export const DD_EXERCISE_PREFIX = 'dd:';

/**
 * One-sided rows as sets, so Left/right balance can compare them alongside
 * COLOSSUS's own unilateral work. Ids are `dd:<exercise name>`; these never
 * enter the fatigue model (the workout's own entry already covers that).
 */
export function ddSideSets(logs: DDLog[]): SetLog[] {
  const out: SetLog[] = [];
  for (const log of logs) {
    const at = parseYmd(log.date).getTime() + 12 * 3_600_000;
    (log.rows ?? []).forEach((row, r) => {
      if (row.side !== 'left' && row.side !== 'right') return;
      if (!row.reps) return;
      for (let i = 0; i < Math.max(1, row.sets ?? 1); i += 1) {
        out.push({
          id: `${log.id}-${r}-${i}`,
          sessionId: log.id,
          exerciseId: `${DD_EXERCISE_PREFIX}${row.exercise.trim()}`,
          setIndex: i,
          side: row.side,
          weight: row.weight ?? 0,
          reps: row.reps,
          rpe: 8,
          completedAt: at,
        });
      }
    });
  }
  return out;
}

export interface DDLiftTrend {
  exercise: string;
  first: number;
  latest: number;
  times: number;
}

/** Top weight per exercise, first time logged vs latest — heaviest change first. */
export function ddLiftTrends(logs: DDLog[]): DDLiftTrend[] {
  const byName = new Map<string, { date: string; top: number }[]>();
  for (const log of [...logs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const tops = new Map<string, number>();
    for (const row of log.rows ?? []) {
      if (!row.weight) continue;
      const name = row.exercise.trim();
      tops.set(name, Math.max(tops.get(name) ?? 0, row.weight));
    }
    for (const [name, top] of tops) byName.set(name, [...(byName.get(name) ?? []), { date: log.date, top }]);
  }
  return [...byName.entries()]
    .map(([exercise, xs]) => ({ exercise, first: xs[0]!.top, latest: xs.at(-1)!.top, times: xs.length }))
    .sort((a, b) => b.latest - b.first - (a.latest - a.first));
}
