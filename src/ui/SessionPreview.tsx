/**
 * Session preview — the full exercise list as cards, right on the home
 * screen instead of hidden until you press Start. Each card also surfaces
 * the ladder rung a bodyweight/band exercise sits on and what the next one
 * up is — progression that was previously invisible even though it's one
 * of the app's best ideas.
 */

import { CATALOG } from '../../catalog/exercises';
import { buildLadderIndex, rungDepth } from '../engine/ladders';
import type { Equipment, Gym, PrescribedExercise } from '../engine/types';

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
}

export function SessionPreview({ exercises, gym }: SessionPreviewProps) {
  const availableEquipment = new Set(gym.equipment);

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
