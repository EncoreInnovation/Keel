import { describe, expect, it } from 'vitest';
import {
  computeDDPlan,
  DD_BY_ID,
  ddRoadmap,
  DEFAULT_DD_SETTINGS,
  noExcusesFor,
  type DDLog,
} from '../src/programs/digDeeper';

const S = DEFAULT_DD_SETTINGS; // Mon Oct 26 2026, Mon–Sat, with Saturday cardio
const title = (id?: string) => (id ? DD_BY_ID.get(id)!.title : undefined);
let n = 0;
const log = (date: string, slotId: string, type: DDLog['type'] = 'completed', performed?: string): DDLog => ({
  id: `l${n++}`,
  date,
  slotId,
  type,
  scheduledWorkoutId: undefined,
  performedWorkoutId: performed,
  createdAt: n,
});

describe('Dig Deeper schedule', () => {
  it('starts with Upper Body Circuit 1 on Mon Oct 26 and cardio on Sat Oct 31', () => {
    const plan = computeDDPlan(S, [], '2026-10-26');
    expect(title(plan.today?.workoutId)).toBe('Upper Body Circuit 1');
    expect(plan.projection.find((p) => p.date === '2026-10-31')!.slot.workoutId).toBe('dc6');
    expect(plan.projection.some((p) => p.date === '2026-11-01')).toBe(false); // Sunday off
    expect(plan.total).toBe(72);
  });

  it('runs Sculpt & Define from week 5 and The Build from week 9', () => {
    const plan = computeDDPlan(S, [], '2026-10-26');
    expect(plan.slots.find((s) => s.id === 'w5d1')!.workoutId).toBe('sd1');
    expect(plan.slots.find((s) => s.id === 'w9d1')!.workoutId).toBe('tb1');
  });

  it('finishes officially on Sat Jan 16 2027', () => {
    expect(computeDDPlan(S, [], '2026-10-26').officialFinish).toBe('2027-01-16');
    expect(computeDDPlan({ ...S, includeCardio: false }, [], '2026-10-26').officialFinish).toBe('2027-01-15');
  });

  it('moves on to the next workout once today is logged', () => {
    const plan = computeDDPlan(S, [log('2026-10-26', 'w1d1')], '2026-10-26');
    expect(plan.today).toBeUndefined();
    expect(plan.loggedToday).toHaveLength(1);
    expect(title(plan.next?.workoutId)).toBe('Lower Body Circuit 1');
    expect(plan.projection[0]!.date).toBe('2026-10-27');
  });

  it('pushes the plan back a day for a missed day instead of doubling up', () => {
    // Trained Monday, missed Tuesday: Wednesday is Lower Body Circuit 1, not Total Body.
    const plan = computeDDPlan(S, [log('2026-10-26', 'w1d1')], '2026-10-28');
    expect(title(plan.today?.workoutId)).toBe('Lower Body Circuit 1');
    // The last workout slides from Sat Jan 16 over Sunday's rest to Mon Jan 18.
    expect(plan.projectedFinish).toBe('2027-01-18');
    expect(plan.daysBehind).toBe(2);
    expect(plan.consistency).toBe(50);
  });

  it('counts a skip and a substitute as using up the slot, but not a rest day', () => {
    const logs = [
      log('2026-10-26', 'w1d1', 'substitute', 'ne1'),
      log('2026-10-27', 'w1d2', 'skipped'),
      { ...log('2026-10-28', 'w1d3', 'rest'), slotId: undefined },
    ];
    const plan = computeDDPlan(S, logs, '2026-10-29');
    expect(plan.done).toBe(2);
    expect(title(plan.today?.workoutId)).toBe('Total Body Circuit');
  });

  it('waits for the start date', () => {
    const plan = computeDDPlan({ ...S, startDate: '2026-11-02' }, [], '2026-10-29');
    expect(plan.today).toBeUndefined();
    expect(plan.projection[0]!.date).toBe('2026-11-02');
    expect(plan.consistency).toBeUndefined();
  });

  it('is complete once every slot is used', () => {
    const plan = computeDDPlan(S, computeDDPlan(S, [], '2026-10-26').slots.map((s) => log('2027-01-16', s.id)), '2027-01-17');
    expect(plan.complete).toBe(true);
    expect(plan.next).toBeUndefined();
  });
});

describe('No Excuses swaps', () => {
  it('offers the closest short workout first', () => {
    expect(noExcusesFor('sd3')[0]!.id).toBe('ne2'); // Legs → No Excuses Legs
    expect(noExcusesFor('tb1')[0]!.id).toBe('ne1'); // Chest → Chest & Back
    expect(noExcusesFor('sd5')[0]!.id).toBe('ne3'); // Bis & Tris → Shoulders, Bis & Tris
    expect(noExcusesFor('dc6')).toEqual([]); // cardio has no short swap
  });
});

describe('Dig Deeper roadmap', () => {
  it('lays the three collections over 12 weeks with the holidays', () => {
    const weeks = ddRoadmap(S.startDate);
    expect(weeks).toHaveLength(12);
    expect(weeks.map((w) => w.collection).join('')).toBe('dcdcdcdcsdsdsdsdtbtbtbtb');
    expect(weeks.find((w) => w.events.includes('Thanksgiving'))!.week).toBe(5);
    expect(weeks.find((w) => w.events.includes('Christmas'))!.week).toBe(9);
    expect(weeks.at(-1)!.end).toBe('2027-01-17');
  });
});
