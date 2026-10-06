/**
 * Q4 roadmap — where the plan is, where you are in it, and whether the body
 * is moving. One hero figure (week of the plan), a week-by-week strip, the
 * holidays placed in their weeks, and the two trends that answer "is it
 * working" for a physique goal: bodyweight and waist.
 */

import { useEffect, useState } from 'react';
import { buildRoadmap, currentWeekIndex, daysUntil, type RoadmapWeek } from '../engine/roadmap';
import { getActiveBlock, getBlockHistory, getBodyMetrics, getCompletedSessions } from '../storage/repository';
import type { BodyMetricLog } from '../engine/types';
import { TrendChart } from './charts/TrendChart';
import { COACHING_TIPS, SEXUAL_HEALTH_NOTES } from '../mind/guidance';

export interface RoadmapProps {
  onBack: () => void;
}

const PHASE_LABEL: Record<RoadmapWeek['phase'], string> = { build: 'Build', deload: 'Deload', retest: 'Retest' };

function range(w: RoadmapWeek): string {
  const f = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(w.start)} – ${f(w.end - 86_400_000)}`;
}

export function Roadmap({ onBack }: RoadmapProps) {
  const [weeks, setWeeks] = useState<RoadmapWeek[] | undefined>();
  const [doneThisWeek, setDoneThisWeek] = useState(0);
  const [metrics, setMetrics] = useState<BodyMetricLog[]>([]);
  const now = Date.now();

  useEffect(() => {
    void (async () => {
      const [history, active, sessions, body] = await Promise.all([
        getBlockHistory(),
        getActiveBlock(),
        getCompletedSessions(),
        getBodyMetrics(),
      ]);
      const firstStart = history[0]?.startedAt ?? active?.startedAt ?? now;
      const plan = buildRoadmap(firstStart);
      const current = plan[currentWeekIndex(plan, now)]!;
      setWeeks(plan);
      setDoneThisWeek(sessions.filter((s) => (s.completedAt ?? s.startedAt) >= current.start).length);
      setMetrics(body);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!weeks) return <div className="today today--loading">Loading…</div>;

  const currentIndex = currentWeekIndex(weeks, now);
  const current = weeks[currentIndex]!;
  const retest = weeks.at(-1)!;
  const weight = metrics.filter((m) => m.weight !== undefined).map((m) => ({ at: m.at, value: m.weight! }));
  const waist = metrics.filter((m) => m.measurements?.waist !== undefined).map((m) => ({ at: m.at, value: m.measurements!.waist! }));

  return (
    <div className="phase-screen roadmap">
      <div className="phase-screen__eyebrow">Q4 roadmap</div>
      <p className="screen-explainer">
        Your 12 weeks to year-end, phase by phase. The app adjusts training for you — glance here
        weekly to see where you are and what's next.
      </p>

      <div className="roadmap__hero">
        <div className="roadmap__hero-value">Week {Math.min(currentIndex + 1, 12)}</div>
        <div className="roadmap__hero-label">
          of 12 · {PHASE_LABEL[current.phase]} · {daysUntil(retest.start, now)} days to retest
        </div>
      </div>

      <div className="roadmap__strip" role="list" aria-label="Weeks of the plan">
        {weeks.map((w) => (
          <div
            key={w.index}
            role="listitem"
            className={`roadmap__week roadmap__week--${w.phase}${w.index === currentIndex ? ' roadmap__week--current' : ''}${w.index < currentIndex ? ' roadmap__week--past' : ''}`}
            title={`${PHASE_LABEL[w.phase]} · ${range(w)}${w.events.length ? ' · ' + w.events.join(', ') : ''}`}
          >
            <span className="roadmap__week-num">{w.phase === 'retest' ? 'R' : w.weekInBlock}</span>
            {w.events.length > 0 && <span className="roadmap__week-flag" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="roadmap__legend">
        <span><i className="roadmap__key roadmap__key--build" /> Build</span>
        <span><i className="roadmap__key roadmap__key--deload" /> Deload</span>
        <span><i className="roadmap__key roadmap__key--retest" /> Retest</span>
        <span><i className="roadmap__key roadmap__key--flag" /> Holiday</span>
      </div>

      <section className="roadmap__section">
        <h2 className="settings-section__title">This week</h2>
        <p className="roadmap__line">
          <span data-numeric>{doneThisWeek}</span> of 3–4 sessions done · {range(current)}
          {current.phase === 'deload' && ' · lighter on purpose — recovery is where the growth lands'}
        </p>
        {current.events.length > 0 && (
          <p className="roadmap__line roadmap__line--dim">
            {current.events.join(', ')} this week — three sessions is a full week. Use “Short on time” if needed.
          </p>
        )}
      </section>

      <section className="roadmap__section">
        <h2 className="settings-section__title">The plan</h2>
        <ol className="roadmap__list">
          {weeks.map((w) => (
            <li key={w.index} className={w.index === currentIndex ? 'roadmap__list-row roadmap__list-row--current' : 'roadmap__list-row'}>
              <span>
                {w.phase === 'retest' ? 'Retest week' : `Block ${w.block} · week ${w.weekInBlock}`}
                {w.events.length > 0 && <span className="roadmap__list-event"> · {w.events.join(', ')}</span>}
              </span>
              <span className="roadmap__list-meta">
                {PHASE_LABEL[w.phase]} · {range(w)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="roadmap__section">
        <h2 className="settings-section__title">Body</h2>
        {weight.length === 0 && waist.length === 0 ? (
          <p className="placeholder__body">Log weight and waist on the Progress screen each week to see the trend here.</p>
        ) : (
          <>
            <TrendChart title="Bodyweight" points={weight} unit="lb" lowerIsBetter />
            <TrendChart title="Waist" points={waist} unit="in" lowerIsBetter />
          </>
        )}
      </section>

      <section className="roadmap__section">
        <h2 className="settings-section__title">Coach’s notes</h2>
        <ul className="guidance-list">
          {COACHING_TIPS.map((tip) => (
            <li key={tip.id} className="guidance-list__item">
              <div className="guidance-list__title">{tip.title}</div>
              <div className="guidance-list__body">{tip.body}</div>
              <div className="guidance-list__source">{tip.source}</div>
            </li>
          ))}
        </ul>
        <p className="guidance-list__disclaimer">General guidance, not medical advice.</p>
      </section>

      <section className="roadmap__section">
        <h2 className="settings-section__title">Testosterone & sexual health</h2>
        <ul className="guidance-list">
          {SEXUAL_HEALTH_NOTES.map((tip) => (
            <li key={tip.id} className="guidance-list__item">
              <div className="guidance-list__title">{tip.title}</div>
              <div className="guidance-list__body">{tip.body}</div>
              <div className="guidance-list__source">{tip.source}</div>
            </li>
          ))}
        </ul>
        <p className="guidance-list__disclaimer">
          General information, not medical advice. Symptoms of low testosterone or erectile changes are worth a doctor’s visit — ED can be an early heart-health signal.
        </p>
      </section>

      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
