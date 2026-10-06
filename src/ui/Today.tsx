/**
 * Today — the home screen.
 *
 * Was a single hero button and nothing else. That fit the original
 * zero-decision, ADHD-first design, but the app pivoted to a physique-first
 * tool where you want information, not just a start button: what's aligned
 * or isn't, what's recovered, what today actually contains. This is now a
 * real dashboard — the alignment strip up top answers "which side is worse"
 * before anything else, because that's the one thing that was buried behind
 * navigation and asked for directly.
 */

import { useEffect, useState } from 'react';
import type { Exercise, Gym, GymId, PillarKind, PrescribedSession } from '../engine/types';
import { currentStreak, sessionsThisWeek } from '../engine/streak';
import { CATALOG } from '../../catalog/exercises';
import type { Recommendation } from '../pillars/recommend';
import { loadRecommendations } from '../state/recommendations';
import { RecommendationCard } from './RecommendationCard';
import { appendBodyMetric, getBodyMetrics, getCompletedSessions, getPhysiqueLogs } from '../storage/repository';
import { physiqueDue, weighInDue } from '../engine/checkins';
import type { SwapCandidate } from '../state/sessionController';
import { SessionPreview } from './SessionPreview';

export interface TodayProps {
  prescription: PrescribedSession;
  weeksTotal: number;
  resumed: boolean;
  /** AI readiness commentary, if the coach was reachable — purely supplementary, never blocks rendering. */
  coachNote?: string;
  gyms: Gym[];
  activeGymId: GymId;
  onSwitchGym: (id: GymId) => void;
  onStart: () => void;
  onOpenPillar: (kind: PillarKind) => void;
  onOpenConditioning: () => void;
  onOpenRoadmap: () => void;
  /** Toggle the 20–25 min version; only offered before the session starts. */
  onToggleExpress: () => void;
  onOpenPhysiqueCheckin: () => void;
  onSwapExercise: (slotId: string, newExerciseId: string) => void;
  loadSwapCandidates: (slotId: string) => Promise<SwapCandidate[]>;
}

export function Today({
  prescription,
  weeksTotal,
  resumed,
  coachNote,
  gyms,
  activeGymId,
  onSwitchGym,
  onStart,
  onOpenPillar,
  onOpenConditioning,
  onOpenRoadmap,
  onToggleExpress,
  onOpenPhysiqueCheckin,
  onSwapExercise,
  loadSwapCandidates,
}: TodayProps) {
  const label = prescription.dayName;

  const [streak, setStreak] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [showWeighIn, setShowWeighIn] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | undefined>();
  const [weightIn, setWeightIn] = useState('');
  const [waistIn, setWaistIn] = useState('');

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    void getBodyMetrics().then((m) => !cancelled && setShowWeighIn(weighInDue(m, now)));
    void getPhysiqueLogs().then((l) => !cancelled && setShowPhotos(physiqueDue(l, now)));
    void loadRecommendations(CATALOG as Exercise[], prescription, now).then((r) => !cancelled && setRecommendation(r[0]));
    void getCompletedSessions().then((sessions) => {
      if (cancelled) return;
      const dates = sessions.map((s) => s.completedAt ?? s.startedAt);
      setStreak(currentStreak(dates, now));
      setWeekCount(sessionsThisWeek(dates, now));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="today">
      {showWeighIn && (
        <div className="checkin-card">
          <div className="checkin-card__title">Weekly check-in — weight and waist</div>
          <div className="checkin-card__row">
            <input type="number" inputMode="decimal" placeholder="Weight (lb)" value={weightIn} onChange={(e) => setWeightIn(e.target.value)} aria-label="Weight in pounds" />
            <input type="number" inputMode="decimal" placeholder="Waist (in)" value={waistIn} onChange={(e) => setWaistIn(e.target.value)} aria-label="Waist in inches" />
            <button
              className="btn btn--ghost"
              onClick={() => {
                const weight = Number(weightIn) || undefined;
                const waist = Number(waistIn) || undefined;
                if (!weight && !waist) return;
                void appendBodyMetric({ id: `bm-${Date.now()}`, at: Date.now(), weight, measurements: waist ? { waist } : undefined }).then(
                  () => setShowWeighIn(false),
                );
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
      {showPhotos && (
        <button className="checkin-card checkin-card--button" onClick={onOpenPhysiqueCheckin}>
          <div className="checkin-card__title">Monthly physique photos ›</div>
          <div className="placeholder__body">Front, side, back — the change the mirror hides week to week.</div>
        </button>
      )}

      <button className="today__meta today__meta--link" onClick={onOpenRoadmap} aria-label="Open the Q4 roadmap">
        Block week {prescription.weekNumber} of {weeksTotal}
        {prescription.isDeload ? ' · Deload' : ''} · Q4 plan ›
      </button>
      <h1 className="today__day">{label}</h1>
      <div className="today__estimate" data-numeric>
        {prescription.estimatedMinutes} min
      </div>

      {coachNote && <div className="coach-note">{coachNote}</div>}

      {/* Switching gyms changes what today's session can be built from, so it
          only makes sense before a session exists — once one's active, its
          exercises are already locked in against whichever gym generated it. */}
      {!resumed && gyms.length > 1 && (
        <div className="gym-switch">
          {gyms.map((gym) => (
            <button
              key={gym.id}
              className={`chip${gym.id === activeGymId ? ' chip--active' : ''}`}
              onClick={() => onSwitchGym(gym.id)}
            >
              {gym.name}
            </button>
          ))}
        </div>
      )}

      <button className="btn btn--hero" onClick={onStart}>
        {resumed ? 'Continue' : 'Start'}
      </button>
      {!resumed && (
        <button className="btn btn--text today__express" onClick={onToggleExpress}>
          {prescription.express ? 'Back to the full session' : 'Short on time? 25-min version'}
        </button>
      )}
      <button className="btn btn--text" onClick={onOpenConditioning}>
        Did Insanity or a run? Log it
      </button>

      {recommendation && <RecommendationCard rec={recommendation} onOpen={onOpenPillar} />}

      {(streak > 0 || weekCount > 0) && (
        <div className="today__streak">
          {streak > 0 && (
            <span className="today__streak-item">
              <span data-numeric>{streak}</span> day streak
            </span>
          )}
          <span className="today__streak-item">
            <span data-numeric>{weekCount}</span> this week
          </span>
        </div>
      )}

      <SessionPreview
        exercises={prescription.exercises}
        gym={gyms.find((g) => g.id === activeGymId) ?? gyms[0]!}
        // Swapping only makes sense before a session is actively being
        // trained — same reasoning as the gym switch above: once sets exist
        // against an exercise, replacing it out from under a resumed session
        // would strand those logged sets under an id nothing points to anymore.
        onSwap={resumed ? undefined : onSwapExercise}
        loadSwapCandidates={resumed ? undefined : loadSwapCandidates}
      />

    </div>
  );
}

