/**
 * The add-ons that go after a workout: a progressive stair-climber program,
 * a progressive jump-rope program, and the sauna.
 *
 * Lift first, cardio after. The lifting gets your freshest effort — that's
 * where muscle is kept during a fat-loss phase — and 10–25 minutes of stairs
 * or rope afterwards still burns well because you're already warm.
 *
 * Both programs progress by how a session felt, not by the calendar: "right"
 * or "too easy" unlocks the next session, "too hard" (or stopping early)
 * repeats it. A program that marches on regardless of how the last session
 * went is how a 285 lb lifter ends up with sore Achilles.
 */

import type { ConditioningLog, FinisherRating } from '../engine/types';

export type FinisherKind = 'stairs' | 'rope' | 'sauna';

export interface Segment {
  label: string;
  seconds: number;
  /** Stair-climber level for this segment. */
  level?: number;
  /** What to do, in a few words. */
  cue: string;
  /** Rest segments render dimmer and don't count as work. */
  rest?: boolean;
}

export interface FinisherSession {
  kind: FinisherKind;
  /** 1-based session number within its program. */
  number: number;
  total: number;
  title: string;
  summary: string;
  segments: Segment[];
}

export const STAIR_SESSIONS = 24;
export const ROPE_SESSIONS = 20;
export const DEFAULT_STAIR_BASE = 5;
const MIN = 60;

export function totalSeconds(s: FinisherSession): number {
  return s.segments.reduce((sum, x) => sum + x.seconds, 0);
}

/* ------------------------------------------------------------------ *
 * Stair climber
 *
 * Machines disagree about what "level 8" means, so every session is set
 * from your base level — the one where a steady pace feels about 6/10.
 * Easy is base − 2, hard is base + 3.
 * ------------------------------------------------------------------ */

export function stairSession(n: number, base = DEFAULT_STAIR_BASE): FinisherSession {
  const number = Math.min(Math.max(1, Math.round(n)), STAIR_SESSIONS);
  const easy = Math.max(1, base - 2);
  const hard = base + 3;
  const segs: Segment[] = [];
  let summary: string;

  if (number <= 6) {
    const steady = 7 + number; // 8 → 13 min
    segs.push({ label: 'Warm-up', seconds: 2 * MIN, level: easy, cue: 'Easy pace, light hands on the rails' });
    segs.push({ label: 'Steady', seconds: steady * MIN, level: base, cue: 'Tall chest, whole foot on the step — you can talk in short sentences' });
    segs.push({ label: 'Cool-down', seconds: 2 * MIN, level: easy, cue: 'Bring the breathing down' });
    summary = `${steady} min steady at level ${base}`;
  } else if (number <= 14) {
    const rounds = 5 + Math.floor((number - 7) / 2); // 5 → 8
    segs.push({ label: 'Warm-up', seconds: 3 * MIN, level: easy, cue: 'Easy pace' });
    for (let r = 1; r <= rounds; r += 1) {
      segs.push({ label: `Hard ${r}/${rounds}`, seconds: MIN, level: hard, cue: 'Push — about 8/10, no hanging on the rails' });
      segs.push({ label: 'Easy', seconds: MIN, level: base, cue: 'Recover, keep stepping', rest: true });
    }
    segs.push({ label: 'Cool-down', seconds: 2 * MIN, level: easy, cue: 'Bring the breathing down' });
    summary = `${rounds} × 1 min hard (level ${hard}) / 1 min easy`;
  } else {
    const rounds = 4 + Math.floor((number - 15) / 3); // 4 → 7
    segs.push({ label: 'Warm-up', seconds: 3 * MIN, level: easy, cue: 'Easy pace' });
    for (let r = 1; r <= rounds; r += 1) {
      segs.push({ label: `Hard ${r}/${rounds}`, seconds: 2 * MIN, level: hard, cue: 'Strong and steady — 8/10' });
      segs.push({ label: 'Easy', seconds: MIN, level: base, cue: 'Recover, keep stepping', rest: true });
    }
    segs.push({ label: 'Cool-down', seconds: 2 * MIN, level: easy, cue: 'Bring the breathing down' });
    summary = `${rounds} × 2 min hard (level ${hard}) / 1 min easy`;
  }

  const session: FinisherSession = { kind: 'stairs', number, total: STAIR_SESSIONS, title: `Stair climber ${number}/${STAIR_SESSIONS}`, summary, segments: segs };
  return session;
}

/* ------------------------------------------------------------------ *
 * Jump rope
 *
 * At this bodyweight the limiter is the calves and Achilles, not the lungs,
 * so it starts with short bouts and long rests and grows from there.
 * ------------------------------------------------------------------ */

export const ROPE_CUES = [
  'Jump an inch or less — just enough to clear the rope.',
  'Land softly on the balls of your feet; heels never slam.',
  'Turn the rope with your wrists, elbows close to your sides.',
  'Gym floor or rubber, not concrete. Supportive shoes.',
  'Missed a jump? Reset and keep going — misses are normal for weeks.',
];

export function ropeSession(n: number): FinisherSession {
  const number = Math.min(Math.max(1, Math.round(n)), ROPE_SESSIONS);
  const segs: Segment[] = [];
  let summary: string;
  const bouts = (rounds: number, on: number, off: number, cue: string) => {
    for (let r = 1; r <= rounds; r += 1) {
      segs.push({ label: `Jump ${r}/${rounds}`, seconds: on, cue });
      if (r < rounds) segs.push({ label: 'Rest', seconds: off, cue: 'Shake out the calves, breathe', rest: true });
    }
  };

  segs.push({ label: 'Warm-up', seconds: MIN, cue: 'Ankle circles, then light bouncing without the rope' });
  if (number <= 5) {
    bouts(8, 20, 40, 'Basic bounce, both feet');
    summary = '8 × 20 s on / 40 s off';
  } else if (number <= 10) {
    bouts(8, 30, 30, 'Basic bounce, both feet');
    summary = '8 × 30 s on / 30 s off';
  } else if (number <= 15) {
    bouts(10, 40, 20, 'Basic bounce, or alternate feet like jogging');
    summary = '10 × 40 s on / 20 s off';
  } else {
    bouts(3, 3 * MIN, MIN, 'Steady rhythm — mix basic and alternate feet');
    summary = '3 × 3 min on / 1 min off';
  }
  segs.push({ label: 'Calf stretch', seconds: MIN, cue: 'Straight-leg calf stretch against a wall, 30 s a side', rest: true });

  return { kind: 'rope', number, total: ROPE_SESSIONS, title: `Jump rope ${number}/${ROPE_SESSIONS}`, summary, segments: segs };
}

/* ------------------------------------------------------------------ *
 * Sauna
 * ------------------------------------------------------------------ */

export const SAUNA_GUIDANCE = [
  'After training, 2–4 times a week. Start at 10 minutes and build to 15–20.',
  'Drink 16–24 oz of water around it — you can sweat out a pound or more.',
  'Skip it after alcohol, if you feel dizzy, or if you are unwell. Get out the moment you feel light-headed.',
  'On blood-pressure medicine or with a heart condition? Check with your doctor first.',
  'Regular sauna use is linked with lower cardiovascular risk in large Finnish studies (Laukkanen, JAMA Intern Med 2015).',
  'Regular heat lowers sperm production. It recovers once you cut back — about 6 months in one study (Garolla, Hum Reprod 2013). If you are trying for kids, keep it occasional.',
];

/** 10 min for the first few visits, then 15, then 20; an optional second round after a cool shower. */
export function saunaSession(visits: number, secondRound = false): FinisherSession {
  const minutes = visits < 3 ? 10 : visits < 8 ? 15 : 20;
  const segs: Segment[] = [{ label: 'Sauna', seconds: minutes * MIN, cue: 'Sit or lie back, slow nose breathing. Out early if light-headed.' }];
  if (secondRound) {
    segs.push({ label: 'Cool shower', seconds: 3 * MIN, cue: 'Cool, not icy. Drink water.', rest: true });
    segs.push({ label: 'Sauna round 2', seconds: Math.round(minutes * 0.75) * MIN, cue: 'Same again, a little shorter.' });
  }
  return {
    kind: 'sauna',
    number: visits + 1,
    total: 0,
    title: 'Sauna',
    summary: `${minutes} min${secondRound ? ' + cool shower + round 2' : ''}`,
    segments: segs,
  };
}

/* ------------------------------------------------------------------ *
 * Progression
 * ------------------------------------------------------------------ */

const KIND_FOR: Record<'stairs' | 'rope', ConditioningLog['kind']> = { stairs: 'stairs', rope: 'rope' };

/**
 * The next session to do: one past the last session that went "right" or
 * "easy", or the same one again if it was "hard". Logs without a session
 * number (a hand-logged stair session) don't move the program.
 */
export function nextSessionNumber(logs: ConditioningLog[], program: 'stairs' | 'rope'): number {
  const total = program === 'stairs' ? STAIR_SESSIONS : ROPE_SESSIONS;
  const last = logs
    .filter((l) => l.kind === KIND_FOR[program] && l.finisherSession !== undefined)
    .sort((a, b) => a.startedAt - b.startedAt)
    .at(-1);
  if (!last) return 1;
  const n = last.finisherSession!;
  return Math.min(total, last.rating === 'hard' ? n : n + 1);
}

export function saunaVisits(logs: ConditioningLog[]): number {
  return logs.filter((l) => l.kind === 'sauna').length;
}

export interface FinisherResult {
  elapsedSec: number;
  completed: boolean;
  rating?: FinisherRating;
  /** Stair session 1 only: the level that felt 6/10, which sets every later session. */
  baseLevel?: number;
}

export const RATING_LABEL: Record<FinisherRating, string> = {
  easy: 'Too easy',
  right: 'Right',
  hard: 'Too hard',
};
