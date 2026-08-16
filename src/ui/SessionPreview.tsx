/**
 * Session preview — the full exercise list as cards, right on the home
 * screen instead of hidden until you press Start. Each card also surfaces
 * the ladder rung a bodyweight/band exercise sits on and what the next one
 * up is — progression that was previously invisible even though it's one
 * of the app's best ideas.
 */

import { useState } from 'react';
import { CATALOG } from '../../catalog/exercises';
import { buildLadderIndex, rungDepth } from '../engine/ladders';
import type { Equipment, Exercise, Gym, PrescribedExercise } from '../engine/types';
import type { SwapCandidate } from '../state/sessionController';

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));
const LADDER_INDEX = buildLadderIndex(CATALOG);

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest',
  upperBack: 'Upper back',
  lats: 'Lats',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  lowerBack: 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  adductors: 'Adductors',
  neck: 'Neck',
};

/** The gentlest next rung reachable in this gym — mirrors `nextRung`'s own
 *  preference (fewest new pieces of equipment, then alphabetical) without
 *  needing a ladder verdict, since this is a passive preview, not a prescription. */
function nextRungName(exerciseId: string, availableEquipment: ReadonlySet<Equipment>): string | undefined {
  const candidates = (LADDER_INDEX.up.get(exerciseId) ?? [])
    .map((id) => CATALOG_BY_ID.get(id))
    .filter((ex): ex is NonNullable<typeof ex> => Boolean(ex))
    .filter((ex) => ex.equipment.every((e) => availableEquipment.has(e)));

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => a.equipment.length - b.equipment.length || a.name.localeCompare(b.name));
  return candidates[0]!.name;
}

export interface SessionPreviewProps {
  exercises: PrescribedExercise[];
  gym: Gym;
  /** Both omitted (e.g. once a session is resumed) hides the swap affordance entirely. */
  onSwap?: (slotId: string, newExerciseId: string) => void;
  loadSwapCandidates?: (slotId: string) => Promise<SwapCandidate[]>;
}

export function SessionPreview({ exercises, gym, onSwap, loadSwapCandidates }: SessionPreviewProps) {
  const availableEquipment = new Set(gym.equipment);
  const [openSlotId, setOpenSlotId] = useState<string | undefined>();
  const [candidates, setCandidates] = useState<Exercise[]>([]);
  const [loadingSlotId, setLoadingSlotId] = useState<string | undefined>();

  async function toggleSwap(slotId: string) {
    if (openSlotId === slotId) {
      setOpenSlotId(undefined);
      return;
    }
    setOpenSlotId(slotId);
    setCandidates([]);
    if (!loadSwapCandidates) return;
    setLoadingSlotId(slotId);
    const ranked = await loadSwapCandidates(slotId);
    setLoadingSlotId(undefined);
    setCandidates(ranked.slice(0, 6).map((c) => c.exercise));
  }

  function pick(slotId: string, exerciseId: string) {
    onSwap?.(slotId, exerciseId);
    setOpenSlotId(undefined);
    setCandidates([]);
  }

  return (
    <div className="today__section">
      <div className="today__section-title">Today&rsquo;s session</div>
      <div className="session-preview">
        {exercises.map((pe) => {
          const setCount = pe.sets.length;
          const repTarget = pe.sets[0]?.repTarget;
          const depth = rungDepth(pe.exercise.id, LADDER_INDEX);
          const next = pe.exercise.loadType !== 'external' ? nextRungName(pe.exercise.id, availableEquipment) : undefined;

          return (
            <div key={pe.slotId} className={`session-preview__card session-preview__card--${pe.role}`}>
              <div className="session-preview__name">{pe.exercise.name}</div>
              <div className="session-preview__meta">
                <span data-numeric>
                  {setCount} × {repTarget}
                </span>
                <span className="session-preview__muscles">
                  {pe.exercise.primaryMuscles.map((m) => MUSCLE_LABEL[m] ?? m).join(', ')}
                </span>
              </div>
              {(depth > 0 || next) && (
                <div className="session-preview__ladder">
                  {depth > 0 && <span>Rung {depth}</span>}
                  {next && <span>Next: {next}</span>}
                </div>
              )}
              {pe.reducedForRecovery && <div className="session-preview__reduced">Reduced for recovery</div>}
              {onSwap && loadSwapCandidates && pe.role !== 'primary' && (
                <button
                  type="button"
                  className="session-preview__swap-toggle"
                  onClick={() => void toggleSwap(pe.slotId)}
                >
                  {openSlotId === pe.slotId ? 'Cancel' : 'Swap'}
                </button>
              )}
              {openSlotId === pe.slotId && (
                <div className="session-preview__swap-list">
                  {loadingSlotId === pe.slotId && (
                    <span className="session-preview__swap-status">Finding alternatives…</span>
                  )}
                  {loadingSlotId !== pe.slotId && candidates.length === 0 && (
                    <span className="session-preview__swap-status">No alternatives available in this gym.</span>
                  )}
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="chip"
                      onClick={() => pick(pe.slotId, c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
