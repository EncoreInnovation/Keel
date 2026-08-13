/**
 * Session player — the interaction contract from the plan, implemented
 * exactly: one exercise, one set, one oversized DONE button. Steppers
 * pre-filled with the target and last time's numbers as ghost text. Tapping
 * DONE writes the set durably, fires a haptic, and auto-starts the rest
 * timer — nothing else to press.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { logSet, resumePosition, skipSet } from '../state/sessionController';
import { getActiveSession } from '../storage/repository';
import { achievableLoads, nextLoadStep, previousLoadStep } from '../engine/loading';
import { adjustRestSeconds } from '../engine/rest';
import { activeGym } from '../engine/types';
import { RestTimer } from './RestTimer';
import { primeAudio, playSetComplete } from './audio';
import { haptics } from './haptics';
import { rpeLabel } from './rpe';
import type { Block, PrescribedSession, SkipReason, Slot, UserProfile } from '../engine/types';

type Phase = 'loading' | 'set' | 'resting' | 'done';

export interface SessionPlayerProps {
  sessionId: string;
  block: Block;
  profile: UserProfile;
  initialPrescription: PrescribedSession;
  onSessionComplete: () => void;
  /** Save whatever sets were logged, close the session cleanly, and leave. */
  onFinishEarly: () => void;
  /** Leave the session running — it stays "active" and resumes exactly here next time. */
  onPause: () => void;
}

function findSlot(block: Block, dayId: string, slotId: string): Slot | undefined {
  return block.days.find((d) => d.id === dayId)?.slots.find((s) => s.id === slotId);
}

export function SessionPlayer({
  sessionId,
  block,
  profile,
  initialPrescription,
  onSessionComplete,
  onFinishEarly,
  onPause,
}: SessionPlayerProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [prescription, setPrescription] = useState(initialPrescription);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setPos, setSetPos] = useState(0);
  const [message, setMessage] = useState<string | undefined>();
  const [showSkip, setShowSkip] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rpe, setRpe] = useState(7);

  const restSecondsRef = useRef(90);

  // Resume from disk on mount — the position is derived, never assumed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession();
      const sessionSets = active?.sets ?? [];
      const pos = resumePosition(initialPrescription, sessionSets);
      if (cancelled) return;

      if (pos.exerciseIndex >= initialPrescription.exercises.length) {
        onSessionComplete();
        return;
      }
      setExerciseIndex(pos.exerciseIndex);
      setSetPos(pos.setPos);
      setPhase('set');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exercise = prescription.exercises[exerciseIndex];
  const targetSet = exercise?.sets[setPos];
  const slot = exercise ? findSlot(block, prescription.dayId, exercise.slotId) : undefined;

  const physicalSetTotal = useMemo(
    () => (exercise ? new Set(exercise.sets.map((s) => s.setIndex)).size : 0),
    [exercise],
  );
  const physicalSetNumber = targetSet ? targetSet.setIndex + 1 : 0;

  const isLoadable = exercise?.exercise.loadType === 'external';

  // Every weight this exercise can actually be loaded to in today's gym. The
  // stepper walks this list rather than adding a fixed increment, so it can
  // never land on a weight that doesn't physically exist.
  const achievable = useMemo(
    () => (exercise ? achievableLoads(exercise.exercise, activeGym(profile)) : []),
    [exercise, profile],
  );

  // Collapse the how-to panel per exercise, not per set — expanding it once
  // shouldn't re-collapse between set 1 and set 2 of the same movement.
  useEffect(() => {
    setShowInstructions(false);
  }, [exercise?.exercise.id]);

  // Re-fill the steppers whenever the target set changes.
  useEffect(() => {
    if (!targetSet || !exercise) return;
    // A loadable exercise with no logged history yet gets weight 0 from the
    // engine — deliberately, per `overload.ts`'s "first time, find a working
    // load" — but the stepper still needs a starting point to climb from
    // rather than sitting at a literal, easy-to-miss zero.
    setWeight(targetSet.weight > 0 ? targetSet.weight : isLoadable ? (achievable[0] ?? 0) : 0);
    setReps(targetSet.repTarget);
    setRpe(targetSet.targetRpe);
  }, [targetSet, exercise, isLoadable, achievable]);

  if (phase === 'loading' || !exercise || !targetSet || !slot) {
    return <div className="session-player session-player--loading">Loading session…</div>;
  }

  const advance = (justFinishedRestSec: number) => {
    const isLastSetOfExercise = setPos + 1 >= exercise.sets.length;
    const isLastExercise = exerciseIndex + 1 >= prescription.exercises.length;

    if (isLastSetOfExercise && isLastExercise) {
      setPhase('done');
      onSessionComplete();
      return;
    }

    restSecondsRef.current = justFinishedRestSec;
    setPhase('resting');
  };

  const afterRest = () => {
    const isLastSetOfExercise = setPos + 1 >= exercise.sets.length;
    if (isLastSetOfExercise) {
      setExerciseIndex((i) => i + 1);
      setSetPos(0);
    } else {
      setSetPos((p) => p + 1);
    }
    setPhase('set');
  };

  const handleDone = async () => {
    primeAudio();
    const result = await logSet(sessionId, {
      prescription,
      slot,
      exerciseIndex,
      setIndex: targetSet.setIndex,
      side: targetSet.side,
      weight,
      reps,
      rpe,
      at: Date.now(),
      profile,
    });

    playSetComplete();
    haptics.setComplete();
    setPrescription(result.prescription);
    setMessage(result.adjustment.message);
    // Rest matches how the set actually went, not just its slot role — a
    // grinder near target RPE gets more recovery than an easy warm-up set
    // in the same slot would.
    advance(adjustRestSeconds(exercise.restSec, rpe, targetSet.targetRpe));
  };

  const handleSkip = async (reason: SkipReason) => {
    await skipSet(sessionId, exercise, targetSet.setIndex, targetSet.side, reason, Date.now());
    setShowSkip(false);
    setMessage(undefined);
    const isLastSetOfExercise = setPos + 1 >= exercise.sets.length;
    const isLastExercise = exerciseIndex + 1 >= prescription.exercises.length;
    if (isLastSetOfExercise && isLastExercise) {
      setPhase('done');
      onSessionComplete();
      return;
    }
    if (isLastSetOfExercise) {
      setExerciseIndex((i) => i + 1);
      setSetPos(0);
    } else {
      setSetPos((p) => p + 1);
    }
  };

  if (phase === 'resting') {
    return (
      <RestTimer
        seconds={restSecondsRef.current}
        onComplete={() => {
          afterRest();
        }}
      />
    );
  }

  const sideLabel = targetSet.side === 'left' ? 'L' : targetSet.side === 'right' ? 'R' : undefined;

  return (
    <div className="session-player">
      <div className="session-player__header">
        <div className="session-player__eyebrow">
          Set {physicalSetNumber} of {physicalSetTotal}
          {sideLabel ? ` · ${sideLabel}` : ''}
        </div>
        <h1 className="session-player__exercise">{exercise.exercise.name}</h1>
        {exercise.lastPerformance && (
          <div className="session-player__ghost">
            Last time: {exercise.lastPerformance.weight > 0 ? `${exercise.lastPerformance.weight} lb × ` : ''}
            {exercise.lastPerformance.reps} @ RPE {exercise.lastPerformance.rpe}
          </div>
        )}
        {exercise.exercise.breathCue && (
          <div className="session-player__cue">{exercise.exercise.breathCue}</div>
        )}

        {exercise.exercise.instructions.length > 0 && (
          <div className="session-player__howto">
            <button
              className="session-player__howto-toggle"
              onClick={() => setShowInstructions((s) => !s)}
              aria-expanded={showInstructions}
            >
              {showInstructions ? 'Hide form cues' : 'How to'}
            </button>
            {showInstructions && (
              <ol className="session-player__howto-list">
                {exercise.exercise.instructions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            )}
            {showInstructions && exercise.exercise.videoUrl && (
              <a
                className="session-player__howto-video"
                href={exercise.exercise.videoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch technique video
              </a>
            )}
          </div>
        )}
      </div>

      {message && <div className="session-player__toast">{message}</div>}

      <div className="steppers">
        {isLoadable && <WeightStepper value={weight} achievable={achievable} onChange={setWeight} />}
        <Stepper label="reps" value={reps} step={1} min={0} onChange={setReps} />
        <RpeSelector value={rpe} onChange={setRpe} />
      </div>

      <button className="btn btn--hero" onClick={() => void handleDone()}>
        DONE
      </button>

      {!showSkip ? (
        <button className="btn btn--text" onClick={() => setShowSkip(true)}>
          Skip
        </button>
      ) : (
        <div className="skip-reasons">
          {(['pain', 'time', 'equipment', 'other'] as const).map((reason) => (
            <button key={reason} className="chip" onClick={() => void handleSkip(reason)}>
              {reason}
            </button>
          ))}
          <button className="btn btn--text" onClick={() => setShowSkip(false)}>
            Cancel
          </button>
        </div>
      )}

      {!showExit ? (
        <button className="btn btn--text session-player__exit-trigger" onClick={() => setShowExit(true)}>
          Exit
        </button>
      ) : (
        <div className="skip-reasons">
          <button className="chip" onClick={onFinishEarly}>
            Finish early
          </button>
          <button className="chip" onClick={onPause}>
            Pause — resume later
          </button>
          <button className="btn btn--text" onClick={() => setShowExit(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (v: number) => void;
}

function Stepper({ label, value, step, min = 0, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <button className="stepper__btn" onClick={() => onChange(Math.max(min, value - step))} aria-label={`Decrease ${label}`}>
        −
      </button>
      <div className="stepper__value" data-numeric>
        {value}
        <span className="stepper__label">{label}</span>
      </div>
      <button className="stepper__btn" onClick={() => onChange(value + step)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

/**
 * Weight stepper that walks the real rack.
 *
 * A generic +/- stepper is wrong for load: on a home rack of [10, 20, 30]
 * there is nothing at 15, so an increment-based stepper would happily show a
 * weight that cannot be picked up. This one moves between weights that exist,
 * and shows the gap when the jump is a big one so the number isn't a surprise.
 */
function WeightStepper({
  value,
  achievable,
  onChange,
}: {
  value: number;
  achievable: number[];
  onChange: (v: number) => void;
}) {
  const down = previousLoadStep(value, achievable);
  const up = nextLoadStep(value, achievable);

  return (
    <div className="stepper">
      <button
        className="stepper__btn"
        disabled={down === undefined}
        onClick={() => down !== undefined && onChange(down)}
        aria-label="Decrease weight"
      >
        −
      </button>
      <div className="stepper__value" data-numeric>
        {value}
        <span className="stepper__label">lb</span>
      </div>
      <button
        className="stepper__btn"
        disabled={up === undefined}
        onClick={() => up !== undefined && onChange(up)}
        aria-label="Increase weight"
      >
        +
      </button>
    </div>
  );
}

function RpeSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const options = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  return (
    <div className="rpe-selector">
      <div className="rpe-selector__label">How hard was that?</div>
      <div className="rpe-selector__options">
        {options.map((opt) => (
          <button
            key={opt}
            className={`rpe-selector__opt${opt === value ? ' rpe-selector__opt--active' : ''}`}
            onClick={() => onChange(opt)}
            title={rpeLabel(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {/* The number alone meant nothing to anyone who hadn't met RPE before,
          so the selected value always spells itself out. */}
      <div className="rpe-selector__hint">{rpeLabel(Math.round(value))}</div>
    </div>
  );
}
