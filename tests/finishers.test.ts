import { describe, expect, it } from 'vitest';
import {
  nextSessionNumber,
  ropeSession,
  saunaSession,
  stairSession,
  totalSeconds,
} from '../src/programs/finishers';
import type { ConditioningLog, FinisherRating } from '../src/engine/types';

const mins = (s: { segments: { seconds: number }[] }) => s.segments.reduce((t, x) => t + x.seconds, 0) / 60;
const work = (s: { segments: { seconds: number; rest?: boolean; label: string; level?: number }[] }) =>
  s.segments.filter((x) => !x.rest && !/Warm|Cool|Calf/.test(x.label));

describe('stair climber program', () => {
  it('builds steady time from 8 to 13 minutes over the first six sessions', () => {
    expect(work(stairSession(1))[0]!.seconds).toBe(8 * 60);
    expect(work(stairSession(6))[0]!.seconds).toBe(13 * 60);
    expect(mins(stairSession(1))).toBe(12);
  });

  it('sets every level from the base level', () => {
    const s = stairSession(7, 6);
    expect(s.segments[0]!.level).toBe(4); // easy = base − 2
    expect(work(s)[0]!.level).toBe(9); // hard = base + 3
    expect(work(s)).toHaveLength(5);
    expect(work(stairSession(14, 6))).toHaveLength(8);
  });

  it('finishes with 2-minute intervals, about 20–25 minutes', () => {
    expect(work(stairSession(15))).toHaveLength(4);
    expect(work(stairSession(24))).toHaveLength(7);
    expect(totalSeconds(stairSession(24)) / 60).toBe(26);
    expect(work(stairSession(15))[0]!.seconds).toBe(120);
  });
});

describe('jump rope program', () => {
  it('starts with 8 × 20 s and builds to 3 × 3 min', () => {
    const first = work(ropeSession(1));
    expect(first).toHaveLength(8);
    expect(first[0]!.seconds).toBe(20);
    expect(work(ropeSession(11))).toHaveLength(10);
    expect(work(ropeSession(20)).map((x) => x.seconds)).toEqual([180, 180, 180]);
  });
});

describe('sauna', () => {
  it('starts at 10 minutes and builds to 20', () => {
    expect(saunaSession(0).segments[0]!.seconds).toBe(600);
    expect(saunaSession(5).segments[0]!.seconds).toBe(900);
    expect(saunaSession(10).segments[0]!.seconds).toBe(1200);
    expect(saunaSession(10, true).segments).toHaveLength(3);
  });
});

describe('progression', () => {
  const at = (i: number) => 1_800_000_000_000 + i * 86_400_000;
  const done = (kind: 'stairs' | 'rope', session: number, rating: FinisherRating, i: number): ConditioningLog => ({
    id: `c${i}`,
    kind,
    startedAt: at(i),
    durationSec: 600,
    effort: 6,
    impact: 'low',
    source: 'manual',
    finisherSession: session,
    rating,
  });

  it('starts at session 1', () => {
    expect(nextSessionNumber([], 'stairs')).toBe(1);
  });

  it('moves on after right or too easy, repeats after too hard', () => {
    expect(nextSessionNumber([done('stairs', 1, 'right', 1)], 'stairs')).toBe(2);
    expect(nextSessionNumber([done('stairs', 1, 'right', 1), done('stairs', 2, 'hard', 2)], 'stairs')).toBe(2);
    expect(nextSessionNumber([done('stairs', 2, 'easy', 2), done('stairs', 1, 'right', 1)], 'stairs')).toBe(3);
  });

  it('keeps stairs and rope apart and stops at the last session', () => {
    expect(nextSessionNumber([done('rope', 4, 'right', 1)], 'stairs')).toBe(1);
    expect(nextSessionNumber([done('rope', 20, 'right', 1)], 'rope')).toBe(20);
  });
});
