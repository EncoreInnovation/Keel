/**
 * Daily pelvic-floor training for men — both directions, contraction AND
 * relaxation.
 *
 * Evidence: in a randomised trial, pelvic floor exercises restored normal
 * erectile function in 40% of men with ED and improved it in another 35%
 * (Dorey et al., BJU Int 2005); a 12-week pelvic floor programme gave 82%
 * of men with lifelong premature ejaculation control over the reflex
 * (Pastore et al., Ther Adv Urol 2014). Relaxation is trained too: a pelvic
 * floor that is only ever squeezed can become overactive, which causes its
 * own pain and dysfunction — so every session starts and ends with
 * lengthening, and reverse Kegels are a full step, not an afterthought.
 *
 * Progression is by practice, not calendar: every 10 completed sessions
 * (about two weeks of daily use) the holds lengthen, capped at 10 seconds.
 */

import type { BreathProtocol } from '../ui/BreathPacer';
import type { PillarSession } from './types';

export const PELVIC_SESSIONS_PER_LEVEL = 10;

const LEVELS = [
  { hold: 5, holdReps: 10, flicks: 10 },
  { hold: 7, holdReps: 10, flicks: 15 },
  { hold: 8, holdReps: 12, flicks: 20 },
  { hold: 10, holdReps: 12, flicks: 20 },
] as const;

export function pelvicLevel(completedSessions: number): number {
  return Math.min(LEVELS.length - 1, Math.floor(completedSessions / PELVIC_SESSIONS_PER_LEVEL));
}

const DROP_BREATH: BreathProtocol = {
  name: 'Pelvic breath',
  phases: [
    { kind: 'in', seconds: 4, label: 'Inhale — let the pelvic floor drop' },
    { kind: 'out', seconds: 6, label: 'Exhale — let it rise on its own' },
  ],
};

function holdProtocol(seconds: number): BreathProtocol {
  return {
    name: `${seconds}s holds`,
    phases: [
      { kind: 'in', seconds, label: 'Squeeze and lift — keep breathing' },
      { kind: 'out', seconds, label: 'Fully relax' },
    ],
  };
}

const FLICK: BreathProtocol = {
  name: 'Quick flicks',
  phases: [
    { kind: 'in', seconds: 1, label: 'Squeeze' },
    { kind: 'out', seconds: 1, label: 'Release' },
  ],
};

const REVERSE: BreathProtocol = {
  name: 'Reverse Kegel',
  phases: [
    { kind: 'in', seconds: 4, label: 'Inhale — gently lengthen and bulge down' },
    { kind: 'out', seconds: 4, label: 'Exhale — soften, no squeeze' },
  ],
};

export function pelvicFloorSession(completedSessions: number): PillarSession {
  const level = LEVELS[pelvicLevel(completedSessions)]!;
  return {
    kind: 'pelvic',
    name: 'Pelvic Floor',
    minutes: 6,
    purpose: 'Squeeze-and-relax training for the pelvic floor — better erections and ejaculatory control. Gets harder as you practise.',
    when: 'Once a day, any time — lying or seated, no equipment.',
    steps: [
      {
        type: 'move',
        title: 'Find the right muscle',
        cue: 'Lying or seated. It’s the muscle that stops the flow of urine and holds in gas. Glutes, abs and thighs stay relaxed. Never practise while actually urinating.',
        seconds: 30,
      },
      { type: 'breath', protocol: DROP_BREATH, cycles: 4 },
      { type: 'breath', protocol: FLICK, cycles: level.flicks },
      { type: 'breath', protocol: holdProtocol(level.hold), cycles: level.holdReps },
      { type: 'breath', protocol: REVERSE, cycles: 6 },
      {
        type: 'move',
        title: 'The knack',
        cue: 'Practise a quick lift right before a cough, a sneeze, or standing up — and a light lift with your brace on heavy lifts. Stop and ease off if anything hurts.',
        seconds: 30,
      },
    ],
  };
}
