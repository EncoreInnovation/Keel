/**
 * Mental skills woven into every session — small, evidence-backed, and
 * attached to moments that already exist (the primer, the rest timer, the
 * cooldown) rather than bolted on as homework.
 *
 * - Cue words: short instructional/motivational self-talk improves task
 *   performance (Hatzigeorgiadis et al., Perspect Psychol Sci 2011,
 *   meta-analysis of 32 studies).
 * - Implementation intentions ("if X, then I will Y") roughly double
 *   follow-through on goals (Gollwitzer & Sheeran, Adv Exp Soc Psychol 2006,
 *   d ≈ 0.65 across 94 studies).
 * - Mental rehearsal of a movement measurably adds strength on top of
 *   physical practice (Ranganathan et al., Neuropsychologia 2004; Slimani et
 *   al., J Hum Kinet 2016 review), so rest periods before a primary lift
 *   become a rehearsal, not phone time.
 */

import type { SlotRole } from '../engine/types';

export const CUE_WORDS = ['Brace', 'Drive', 'Smooth', 'Explode', 'Patient', 'Own it'] as const;
export type CueWord = (typeof CUE_WORDS)[number];

export const DEFAULT_IF_THEN =
  'If I want to cut a set short, then I take three slow breaths and finish one more clean rep.';

/** What the rest timer says, depending on what comes next. */
export function restPrompt(nextRole: SlotRole | undefined, cueWord?: string): string {
  const cue = cueWord ? ` Cue: “${cueWord}.”` : '';
  if (nextRole === 'primary') {
    return `Rehearse the next set: see the bar path, feel the brace, picture a clean last rep.${cue}`;
  }
  if (nextRole === 'finisher') {
    return `Last block of work. Long exhales now, then finish strong.${cue}`;
  }
  return `Breathe low and slow — let the heart rate settle.${cue}`;
}

/** Framing shown on finishers, where the work is meant to be uncomfortable. */
export const FINISHER_FRAME =
  'Discomfort here is the point — stay smooth, breathe out hard, and finish the set you started.';

/** The cooldown's one-line reflection prompt. */
export const REFLECTION_PROMPT = 'One line: what went well, and what will you do better next time?';
