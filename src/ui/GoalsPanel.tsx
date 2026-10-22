/**
 * The dated body goals on the Q4 plan: where you started, where the goal is,
 * whether you're on pace, and — when the goal asks for more than 1% a week —
 * when a muscle-safe pace would get you there instead.
 */

import { countdowns } from '../engine/countdowns';
import type { GoalProgress, GoalStatus, MetricGoal, ResolvedGoals } from '../engine/goals';

const STATUS_LABEL: Record<GoalStatus, string> = {
  start: 'Starting point set',
  'on-track': 'On track',
  ahead: 'Ahead',
  behind: 'Behind',
  hit: 'Goal hit',
};

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function Row({ title, goal, unit, perWeekUnit, extra }: { title: string; goal: MetricGoal; unit: string; perWeekUnit: string; extra: string[] }) {
  return (
    <div className="goal-row">
      <div className="goal-row__head">
        <span className="goal-row__title">{title}</span>
        <span className={`goal-row__status goal-row__status--${goal.status}`}>{STATUS_LABEL[goal.status]}</span>
      </div>
      <div className="goal-row__numbers" data-numeric>
        {one(goal.latest)}
        {unit} → {goal.target}
        {unit}
      </div>
      {goal.status !== 'hit' && (
        <div className="goal-row__detail">
          Needs {one(goal.neededPerWeek)} {perWeekUnit}/week
          {goal.actualPerWeek !== undefined &&
            ` · ${goal.actualPerWeek >= 0 ? 'averaging' : 'up'} ${one(Math.abs(goal.actualPerWeek))} ${perWeekUnit}/week${goal.actualPerWeek >= 0 ? '' : ' so far'}`}
        </div>
      )}
      {extra.map((line) => (
        <div key={line} className="goal-row__detail">
          {line}
        </div>
      ))}
    </div>
  );
}

export interface GoalsPanelProps {
  progress: GoalProgress | undefined;
  goals: ResolvedGoals;
  now: number;
}

export function GoalsPanel({ progress, goals, now }: GoalsPanelProps) {
  const deadline = day(goals.deadline);
  const birthday = countdowns(now, goals.birthday).find((c) => c.id === 'birthday')!.date;

  if (!progress || (!progress.weight && !progress.bodyFat && !progress.visceral)) {
    return (
      <p className="placeholder__body">
        Goals: {goals.weight} lb and {goals.bodyFatPct}% body fat by {deadline}. Log your weight — and body fat if your
        scale shows it — in the weekly check-in, and your pace shows up here.
      </p>
    );
  }

  const weightExtra: string[] = [];
  const w = progress.weight;
  if (w?.tooFast) weightExtra.push('Faster than 1% a week. Fine while your lifts hold — if they start dropping, eat a little more.');
  if (w?.projection) {
    const when = day(w.projection.at);
    const beforeBirthday = w.projection.at <= birthday ? ' — still before your birthday' : '';
    weightExtra.push(
      w.projection.basis === 'one-percent'
        ? `At a muscle-safe 1% a week you'd hit ${w.target} around ${when}${beforeBirthday}.`
        : `At your pace you'll hit ${w.target} around ${when}${beforeBirthday}.`,
    );
  }

  const bfExtra: string[] = [];
  const bf = progress.bodyFat;
  if (bf?.projection) bfExtra.push(`At your pace: ${bf.target}% around ${day(bf.projection.at)}.`);

  const v = progress.visceral;
  const visceralWord = v ? { start: 'Starting point set', falling: 'Falling', flat: 'Flat', rising: 'Rising' }[v.direction] : '';

  return (
    <div className="goals">
      {w && <Row title={`Weight by ${deadline}`} goal={w} unit=" lb" perWeekUnit="lb" extra={weightExtra} />}
      {bf && <Row title={`Body fat by ${deadline}`} goal={bf} unit="%" perWeekUnit="pts" extra={bfExtra} />}
      {v && (
        <div className="goal-row">
          <div className="goal-row__head">
            <span className="goal-row__title">Visceral fat</span>
            <span
              className={`goal-row__status goal-row__status--${v.direction === 'falling' ? 'on-track' : v.direction === 'rising' ? 'behind' : 'start'}`}
            >
              {visceralWord}
            </span>
          </div>
          <div className="goal-row__numbers" data-numeric>
            {v.direction === 'start' ? v.latest : `${v.start} → ${v.latest}`}
          </div>
          <div className="goal-row__detail">
            The fat around your organs — the health number. Aim for it to keep falling; it usually drops early in a fat-loss phase.
          </div>
        </div>
      )}
    </div>
  );
}
