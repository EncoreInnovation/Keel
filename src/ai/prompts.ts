/**
 * AI coach — pure prompt construction and log summarization.
 *
 * No network, no API key, nothing that needs a browser. Every function here
 * takes plain data and returns a plain string, so the actual prompt text
 * sent to Gemini is exactly what these tests exercise — not something that
 * only gets checked by eyeballing a live response.
 *
 * What's deliberately absent: anything that sets load, picks exercises, or
 * advances a ladder. The AI coach only ever produces commentary layered on
 * top of numbers the deterministic engine already decided. If a prompt here
 * ever needs to influence `weight` or `reps`, that's the line being crossed.
 */

import { bestE1RM } from '../engine/overload';
import { asymmetryReport, overallGap } from '../engine/asymmetry';
import type { ConditioningLog, Exercise, PillarLog, SetLog } from '../engine/types';
import type { SessionRecord } from '../storage/repository';

const SYSTEM_PREAMBLE =
  "You are a calm, direct strength coach. Two to four sentences, no bullet points, no emoji, no hedging disclaimers. Speak to the person, not about them.";

/* ------------------------------------------------------------------ *
 * Readiness commentary
 * ------------------------------------------------------------------ */

export interface ReadinessPromptInput {
  readiness: number; // 1-5
  dayName: string;
  isDeload: boolean;
  weekNumber: number;
  blockWeeks: number;
}

/**
 * A one-liner reacting to today's readiness tap and the session already
 * generated for it. This never changes the prescription — the deterministic
 * `volumeMultiplier` already did that — it only frames what the numbers mean.
 */
export function buildReadinessPrompt(input: ReadinessPromptInput): string {
  const { readiness, dayName, isDeload, weekNumber, blockWeeks } = input;
  const readinessLabel = ['wiped out', 'low', 'okay', 'good', 'fully charged'][readiness - 1] ?? 'okay';

  return `${SYSTEM_PREAMBLE}

The person just rated their readiness to train today as "${readinessLabel}" (${readiness}/5). Today's session is ${dayName}, week ${weekNumber} of ${blockWeeks}${isDeload ? ' (a deload week)' : ''}. The app has already adjusted today's volume automatically based on this rating — you are not deciding anything, only giving a short, honest read on what to expect from the session and how to approach it mentally. Do not tell them to skip the session or to see a doctor unless they said something alarming.`;
}

/* ------------------------------------------------------------------ *
 * Weekly reflection
 * ------------------------------------------------------------------ */

export interface WeekSummary {
  weekLabel: string;
  sessionsCompleted: number;
  totalSets: number;
  liftLines: string[]; // e.g. "Goblet Squat: 65 lb e1RM"
  pillarMinutes: number;
  pillarSessions: number;
  conditioningLines: string[]; // e.g. "Run: 35 min, effort 7"
  asymmetryNote?: string;
}

/**
 * Summarize a week of logs into short, human-readable lines. Pure and
 * derived straight from the flat logs — the same numbers the Progress
 * screen shows, just prose instead of a sparkline.
 */
export function summarizeWeek(input: {
  weekLabel: string;
  sets: SetLog[];
  completedSessionCount: number;
  catalog: Exercise[];
  pillarLogs: PillarLog[];
  conditioning: ConditioningLog[];
}): WeekSummary {
  const { weekLabel, sets, completedSessionCount, catalog, pillarLogs, conditioning } = input;
  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  const byExercise = new Map<string, SetLog[]>();
  for (const set of sets) {
    const bucket = byExercise.get(set.exerciseId) ?? [];
    bucket.push(set);
    byExercise.set(set.exerciseId, bucket);
  }

  const liftLines: string[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const exercise = catalogById.get(exerciseId);
    if (!exercise || exercise.loadType !== 'external') continue;
    const e1rm = bestE1RM(exerciseSets);
    if (e1rm > 0) liftLines.push(`${exercise.name}: ${Math.round(e1rm)} lb e1RM`);
  }

  const pillarMinutes = Math.round(
    pillarLogs.reduce((sum, p) => (p.completedAt ? sum + (p.completedAt - p.startedAt) / 60_000 : sum), 0),
  );

  const conditioningLines = conditioning.map(
    (c) => `${c.kind}: ${Math.round(c.durationSec / 60)} min, effort ${c.effort}`,
  );

  const gap = overallGap(asymmetryReport(sets));
  const asymmetryNote =
    Math.abs(gap) >= 0.1
      ? `Left/right gap is running ${gap > 0 ? 'right' : 'left'}-dominant, about ${Math.round(Math.abs(gap) * 100)}%.`
      : undefined;

  return {
    weekLabel,
    sessionsCompleted: completedSessionCount,
    totalSets: sets.length,
    liftLines,
    pillarMinutes,
    pillarSessions: pillarLogs.length,
    conditioningLines,
    asymmetryNote,
  };
}

export function buildWeeklyReflectionPrompt(summary: WeekSummary): string {
  const lines = [
    `Week: ${summary.weekLabel}`,
    `Strength sessions completed: ${summary.sessionsCompleted}`,
    `Total sets logged: ${summary.totalSets}`,
    summary.liftLines.length > 0 ? `Estimated 1RMs: ${summary.liftLines.join('; ')}` : undefined,
    `Pillar sessions (breath/mobility): ${summary.pillarSessions}, ${summary.pillarMinutes} min total`,
    summary.conditioningLines.length > 0
      ? `Conditioning: ${summary.conditioningLines.join('; ')}`
      : undefined,
    summary.asymmetryNote,
  ].filter((l): l is string => Boolean(l));

  return `${SYSTEM_PREAMBLE}

Here is what the person logged this week:
${lines.map((l) => `- ${l}`).join('\n')}

Write a short weekly reflection: acknowledge what actually happened (not a generic pep talk), and name exactly one focus for next week. If almost nothing was logged, say that plainly and gently rather than inventing progress.`;
}

/* ------------------------------------------------------------------ *
 * Ask the coach
 * ------------------------------------------------------------------ */

export function summarizeRecentSessions(records: SessionRecord[], limit = 5): string {
  const recent = [...records].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  if (recent.length === 0) return 'No sessions logged yet.';
  return recent
    .map((r) => `Week ${r.weekNumber}, day ${r.dayId}${r.readiness ? ` (readiness ${r.readiness}/5)` : ''}`)
    .join('; ');
}

export function buildAskCoachPrompt(question: string, recentSessionsSummary: string): string {
  return `${SYSTEM_PREAMBLE}

Recent training context: ${recentSessionsSummary}

The person asks: "${question}"

Answer directly using the context above where relevant. If the question needs information you don't have, say what's missing rather than guessing at their specific numbers.`;
}
