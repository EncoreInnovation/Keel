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
 * (about two weeks of daily use) the holds lengthen, capped at 10 seconds,
 * and the position moves on — lying, seated, standing, then moving. The
 * Dorey trial trained all three static positions; control that only exists
 * lying down isn't much use standing or on your knees.
 *
 * Two pieces beyond the classic protocol: a long light hold (endurance — a
 * gentle squeeze sustained while breathing is what keeps rigidity), and
 * "glutes on, pelvic floor off", which trains the floor to stay soft while
 * everything around it works. Clenching under effort and arousal is a big
 * part of finishing early (Myers & Smith, Physiotherapy 2019, review).
 */

import type { BreathProtocol } from '../ui/BreathPacer';
import type { PillarSession } from './types';

export const PELVIC_SESSIONS_PER_LEVEL = 10;

const LEVELS = [
  { hold: 5, holdReps: 10, flicks: 10, longHold: 20, position: 'Lying', where: 'Lie on your back, knees bent, feet flat.' },
  { hold: 7, holdReps: 10, flicks: 15, longHold: 30, position: 'Seated', where: 'Sit tall on a firm chair, feet flat, weight on your sit bones.' },
  { hold: 8, holdReps: 12, flicks: 20, longHold: 40, position: 'Standing', where: 'Stand tall, feet hip-width, knees soft.' },
  {
    hold: 10,
    holdReps: 12,
    flicks: 20,
    longHold: 45,
    position: 'Moving',
    where: 'Standing — and during the long hold, do slow bodyweight squats or march in place while keeping the squeeze.',
  },
] as const;

export type PelvicPosition = (typeof LEVELS)[number]['position'];

export function pelvicPosition(completedSessions: number): PelvicPosition {
  return LEVELS[pelvicLevel(completedSessions)]!.position;
}

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

/** Everything around the pelvic floor works hard; the floor itself stays soft. */
const DISSOCIATE: BreathProtocol = {
  name: 'Glutes on, pelvic floor off',
  phases: [
    { kind: 'in', seconds: 5, label: 'Squeeze glutes and thighs hard — pelvic floor stays soft' },
    { kind: 'out', seconds: 5, label: 'Let everything go' },
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
    minutes: 7,
    purpose: `Squeeze-and-relax training for the pelvic floor — firmer erections and more control. Today: ${level.position.toLowerCase()}. Gets harder as you practise.`,
    when: 'Once a day, any time — no equipment.',
    steps: [
      {
        type: 'move',
        title: `Find the right muscle — ${level.position.toLowerCase()}`,
        cue: `${level.where} It’s the muscle that stops the flow of urine and holds in gas. Glutes, abs and thighs stay relaxed. Never practise while actually urinating.`,
        seconds: 30,
      },
      { type: 'breath', protocol: DROP_BREATH, cycles: 4 },
      { type: 'breath', protocol: FLICK, cycles: level.flicks },
      { type: 'breath', protocol: holdProtocol(level.hold), cycles: level.holdReps },
      {
        type: 'move',
        title: `Long light hold — ${level.longHold} s`,
        cue:
          level.position === 'Moving'
            ? 'About a third of your strongest squeeze. Keep it while you do slow squats or march in place, breathing normally the whole time.'
            : 'About a third of your strongest squeeze, held steady. Breathe normally — if you have to hold your breath, squeeze lighter.',
        seconds: level.longHold,
      },
      { type: 'breath', protocol: DISSOCIATE, cycles: 6 },
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
