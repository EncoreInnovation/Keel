import { describe, expect, it } from 'vitest';
import {
  VOLUME_LANDMARK_MAX,
  VOLUME_LANDMARK_MIN,
  volumeStatus,
  weeklyMuscleVolume,
} from '../src/engine/volume';
import type { Exercise, SetLog } from '../src/engine/types';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

function makeExercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-bench',
    name: 'Test Bench',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    patterns: ['horizontalPush'],
    equipment: ['bodyweight'],
    loadType: 'bodyweight',
    impact: 'none',
    level: 'novice',
    unilateral: false,
    goalFit: 0.5,
    correctiveFit: 0.5,
    jointLoad: ['shoulder'],
    instructions: [],
    images: [],
    ...over,
  };
}

function makeSet(over: Partial<SetLog> = {}): SetLog {
  return {
    id: 's1',
    sessionId: 'sess1',
    exerciseId: 'test-bench',
    setIndex: 0,
    side: 'both',
    weight: 45,
    reps: 10,
    rpe: 8,
    completedAt: T0,
    ...over,
  };
}

describe('weeklyMuscleVolume', () => {
  const catalog = new Map([['test-bench', makeExercise()]]);

  it('counts a set fully toward its primary muscles', () => {
    const volume = weeklyMuscleVolume([makeSet()], catalog, T0);
    expect(volume.chest).toBe(1);
  });

  it('counts a set at half weight toward its secondary muscles', () => {
    const volume = weeklyMuscleVolume([makeSet()], catalog, T0);
    expect(volume.triceps).toBe(0.5);
    expect(volume.shoulders).toBe(0.5);
  });

  it('leaves muscles the exercise never touches at zero', () => {
    const volume = weeklyMuscleVolume([makeSet()], catalog, T0);
    expect(volume.quads).toBe(0);
  });

  it('sums across multiple sets', () => {
    const sets = [makeSet({ id: 's1' }), makeSet({ id: 's2' }), makeSet({ id: 's3' })];
    const volume = weeklyMuscleVolume(sets, catalog, T0);
    expect(volume.chest).toBe(3);
  });

  it('ignores skipped sets', () => {
    const volume = weeklyMuscleVolume([makeSet({ skipped: true })], catalog, T0);
    expect(volume.chest).toBe(0);
  });

  it('ignores sets older than 7 days', () => {
    const stale = makeSet({ completedAt: T0 - 8 * DAY });
    const volume = weeklyMuscleVolume([stale], catalog, T0);
    expect(volume.chest).toBe(0);
  });

  it('includes a set exactly at the 7-day boundary', () => {
    const boundary = makeSet({ completedAt: T0 - 7 * DAY });
    const volume = weeklyMuscleVolume([boundary], catalog, T0);
    expect(volume.chest).toBe(1);
  });

  it('ignores sets that have not happened yet', () => {
    const future = makeSet({ completedAt: T0 + DAY });
    const volume = weeklyMuscleVolume([future], catalog, T0);
    expect(volume.chest).toBe(0);
  });

  it('ignores sets for exercises missing from the catalog map', () => {
    const orphan = makeSet({ exerciseId: 'not-in-catalog' });
    const volume = weeklyMuscleVolume([orphan], catalog, T0);
    expect(volume.chest).toBe(0);
  });

  it('counts each unilateral side as its own set', () => {
    const sets = [
      makeSet({ id: 's1', side: 'left' }),
      makeSet({ id: 's2', side: 'right' }),
    ];
    const volume = weeklyMuscleVolume(sets, catalog, T0);
    expect(volume.chest).toBe(2);
  });
});

describe('volumeStatus', () => {
  it('flags anything below the landmark as under', () => {
    expect(volumeStatus(0)).toBe('under');
    expect(volumeStatus(VOLUME_LANDMARK_MIN - 1)).toBe('under');
  });

  it('treats both ends of the landmark as in range', () => {
    expect(volumeStatus(VOLUME_LANDMARK_MIN)).toBe('in-range');
    expect(volumeStatus(VOLUME_LANDMARK_MAX)).toBe('in-range');
  });

  it('flags anything above the landmark as over', () => {
    expect(volumeStatus(VOLUME_LANDMARK_MAX + 1)).toBe('over');
  });
});
