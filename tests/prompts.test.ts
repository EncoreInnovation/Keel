/**
 * AI coach prompt tests — pure, no network. What matters here is that the
 * prompt text actually contains the numbers it claims to summarize, and
 * that it never asks the model to decide anything the deterministic engine
 * already owns (weight, reps, exercise choice).
 */

import { describe, expect, it } from 'vitest';
import {
  buildAskCoachPrompt,
  buildReadinessPrompt,
  buildWeeklyReflectionPrompt,
  summarizeRecentSessions,
  summarizeWeek,
} from '../src/ai/prompts';
import { CATALOG } from '../catalog/exercises';
import type { Exercise, PillarLog, SetLog } from '../src/engine/types';
import type { SessionRecord } from '../src/storage/repository';

const catalog = CATALOG as Exercise[];
const T0 = 1_700_000_000_000;

describe('buildReadinessPrompt', () => {
  it('translates the numeric rating into its label and includes session context', () => {
    const prompt = buildReadinessPrompt({
      readiness: 1,
      dayName: 'Lower · Squat',
      isDeload: false,
      weekNumber: 3,
      blockWeeks: 6,
    });
    expect(prompt).toContain('wiped out');
    expect(prompt).toContain('1/5');
    expect(prompt).toContain('Lower · Squat');
    expect(prompt).toContain('week 3 of 6');
  });

  it('flags a deload week explicitly', () => {
    const prompt = buildReadinessPrompt({
      readiness: 5,
      dayName: 'Upper · Pull',
      isDeload: true,
      weekNumber: 6,
      blockWeeks: 6,
    });
    expect(prompt).toContain('fully charged');
    expect(prompt).toContain('deload');
  });

  it('never instructs the model to change load, reps, or exercise selection', () => {
    const prompt = buildReadinessPrompt({
      readiness: 2,
      dayName: 'Upper · Push',
      isDeload: false,
      weekNumber: 1,
      blockWeeks: 6,
    });
    expect(prompt).toMatch(/not deciding anything/);
  });
});

describe('summarizeWeek', () => {
  const goblet = catalog.find((e) => e.id === 'goblet-squat')!;
  const pushup = catalog.find((e) => e.id === 'pushup')!; // bodyweight, no e1RM line expected

  function set(over: Partial<SetLog>): SetLog {
    return {
      id: Math.random().toString(36),
      sessionId: 's1',
      exerciseId: goblet.id,
      setIndex: 0,
      side: 'both',
      weight: 50,
      reps: 10,
      rpe: 8,
      completedAt: T0,
      ...over,
    };
  }

  it('produces an e1RM line for loaded work and skips bodyweight exercises', () => {
    const summary = summarizeWeek({
      weekLabel: 'Week 1',
      sets: [set({}), set({ exerciseId: pushup.id, weight: 0, reps: 15 })],
      completedSessionCount: 2,
      catalog,
      pillarLogs: [],
      conditioning: [],
    });
    expect(summary.liftLines.some((l) => l.includes(goblet.name))).toBe(true);
    expect(summary.liftLines.some((l) => l.includes(pushup.name))).toBe(false);
  });

  it('sums pillar minutes only from completed sessions', () => {
    const logs: PillarLog[] = [
      { id: 'p1', kind: 'reset', startedAt: T0, completedAt: T0 + 6 * 60_000 },
      { id: 'p2', kind: 'ground', startedAt: T0, completedAt: undefined }, // never finished
    ];
    const summary = summarizeWeek({
      weekLabel: 'Week 1',
      sets: [],
      completedSessionCount: 0,
      catalog,
      pillarLogs: logs,
      conditioning: [],
    });
    expect(summary.pillarMinutes).toBe(6);
    expect(summary.pillarSessions).toBe(2);
  });

  it('formats conditioning entries', () => {
    const summary = summarizeWeek({
      weekLabel: 'Week 1',
      sets: [],
      completedSessionCount: 0,
      catalog,
      pillarLogs: [],
      conditioning: [
        { id: 'c1', kind: 'run', startedAt: T0, durationSec: 1800, effort: 7, impact: 'moderate', source: 'manual' },
      ],
    });
    expect(summary.conditioningLines).toEqual(['run: 30 min, effort 7']);
  });

  it('only notes asymmetry when the gap is significant', () => {
    const balanced = summarizeWeek({
      weekLabel: 'Week 1',
      sets: [
        set({ id: 'l', side: 'left', exerciseId: 'single-arm-row-db', weight: 30 }),
        set({ id: 'r', side: 'right', exerciseId: 'single-arm-row-db', weight: 30 }),
      ],
      completedSessionCount: 0,
      catalog,
      pillarLogs: [],
      conditioning: [],
    });
    expect(balanced.asymmetryNote).toBeUndefined();

    const skewed = summarizeWeek({
      weekLabel: 'Week 1',
      sets: [
        set({ id: 'l', side: 'left', exerciseId: 'single-arm-row-db', weight: 20 }),
        set({ id: 'r', side: 'right', exerciseId: 'single-arm-row-db', weight: 40 }),
      ],
      completedSessionCount: 0,
      catalog,
      pillarLogs: [],
      conditioning: [],
    });
    expect(skewed.asymmetryNote).toMatch(/right-dominant/);
  });
});

describe('buildWeeklyReflectionPrompt', () => {
  it('includes every populated summary line', () => {
    const prompt = buildWeeklyReflectionPrompt({
      weekLabel: 'Week 2',
      sessionsCompleted: 4,
      totalSets: 24,
      liftLines: ['Goblet Squat: 65 lb e1RM'],
      pillarMinutes: 18,
      pillarSessions: 3,
      conditioningLines: ['run: 30 min, effort 7'],
      asymmetryNote: 'Left/right gap is running right-dominant, about 12%.',
    });
    expect(prompt).toContain('Week 2');
    expect(prompt).toContain('4');
    expect(prompt).toContain('Goblet Squat: 65 lb e1RM');
    expect(prompt).toContain('18 min');
    expect(prompt).toContain('run: 30 min, effort 7');
    expect(prompt).toContain('right-dominant');
    expect(prompt).toContain('exactly one focus');
  });

  it('omits empty sections rather than printing "undefined"', () => {
    const prompt = buildWeeklyReflectionPrompt({
      weekLabel: 'Week 1',
      sessionsCompleted: 0,
      totalSets: 0,
      liftLines: [],
      pillarMinutes: 0,
      pillarSessions: 0,
      conditioningLines: [],
    });
    expect(prompt).not.toContain('undefined');
    expect(prompt).toContain('almost nothing was logged');
  });
});

describe('summarizeRecentSessions', () => {
  it('handles no history without throwing', () => {
    expect(summarizeRecentSessions([])).toBe('No sessions logged yet.');
  });

  it('orders most recent first and caps at the limit', () => {
    const records: SessionRecord[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      blockId: 'b1',
      weekNumber: 1,
      dayId: 'a',
      startedAt: T0 + i * 1000,
    }));
    const summary = summarizeRecentSessions(records, 3);
    expect(summary.split(';').length).toBe(3);
    expect(summary).toContain('day a');
  });

  it('includes readiness when present', () => {
    const summary = summarizeRecentSessions([
      { id: 's1', blockId: 'b1', weekNumber: 2, dayId: 'b', startedAt: T0, readiness: 4 },
    ]);
    expect(summary).toContain('readiness 4/5');
  });
});

describe('buildAskCoachPrompt', () => {
  it('embeds both the question and the context', () => {
    const prompt = buildAskCoachPrompt('Should I train through shoulder soreness?', 'Week 2, day b, readiness 3/5');
    expect(prompt).toContain('Should I train through shoulder soreness?');
    expect(prompt).toContain('Week 2, day b, readiness 3/5');
  });
});
