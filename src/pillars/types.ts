/**
 * Pillar session content model.
 *
 * A session is an ordered list of steps: a breath step drives the ring for a
 * fixed number of cycles, a move step is a held position or motion with a
 * cue and a duration. Kept to two step kinds on purpose — every technique in
 * the plan's pillar library (CARs, 90/90 work, humming, breath protocols)
 * fits one of the two without a third kind earning its keep.
 */

import type { BreathProtocol } from '../ui/BreathPacer';
import type { PillarKind } from '../engine/types';

export interface BreathStep {
  type: 'breath';
  protocol: BreathProtocol;
  cycles: number;
}

export interface MoveStep {
  type: 'move';
  title: string;
  cue: string;
  seconds: number;
}

export type PillarStep = BreathStep | MoveStep;

export interface PillarSession {
  kind: PillarKind;
  name: string;
  /** Approximate — shown on the entry chip before starting. */
  minutes: number;
  steps: PillarStep[];
}
