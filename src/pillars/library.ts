/**
 * The standalone micro-sessions, always one tap from Today: down-regulation
 * (Reset, Cyclic Sigh, Resonance, Deep Rest), up-regulation (Activate),
 * mental skills (Focus), corrective work (Realign), mobility (Unlock), and the
 * no-capacity day (Ground).
 *
 * Content follows the plan's pillar library directly: Reset draws from the
 * nervous-system-down protocols (physiological sigh, 4-7-8, box, coherent,
 * humming), Realign is the corrective/repositioning routine as a standalone
 * dose, Unlock is CARs-and-openers mobility, and Ground is the 5-minute
 * floor-based session for a no-capacity day — the one that matters most,
 * since it's what preserves the habit on the days consistency actually
 * breaks.
 */

import { PROTOCOLS } from '../ui/BreathPacer';
import type { PillarSession } from './types';
import { pelvicFloorSession } from './pelvicFloor';

/**
 * Morning up-regulation, for early sessions. Daylight in the first hour after
 * waking anchors the circadian clock and raises alertness (Wright et al.,
 * Curr Biol 2013; Huberman lab summaries of the light literature). A few
 * rounds of brisk breathing raise adrenaline acutely (Kox et al., PNAS 2014),
 * kept short, hold-free and seated: hyperventilation can cause
 * light-headedness, so never in water or while driving.
 */
const ACTIVATE: PillarSession = {
  kind: 'activate',
  name: 'Activate',
  minutes: 4,
  purpose: 'Wakes the body and brain up: daylight, brisk breathing, light movement.',
  when: 'Early mornings, or when you feel groggy before training.',
  steps: [
    {
      type: 'move',
      title: 'Get light in your eyes',
      cue: 'Outside or at a bright window, no sunglasses. Stand tall, slow nasal breaths. Never stare at the sun.',
      seconds: 60,
    },
    { type: 'breath', protocol: PROTOCOLS.energize, cycles: 20 },
    {
      type: 'move',
      title: 'Recover',
      cue: 'Normal breathing through the nose. Light-headed? Stop the fast breathing for today.',
      seconds: 20,
    },
    { type: 'breath', protocol: PROTOCOLS.energize, cycles: 20 },
    {
      type: 'move',
      title: 'Wake the body',
      cue: 'Ten bodyweight squats, ten arm swings, ten hip hinges. Easy, not hard.',
      seconds: 60,
    },
  ],
};

/** Five minutes of cyclic sighing — see `PROTOCOLS.cyclicSigh`. */
const SIGH: PillarSession = {
  kind: 'sigh',
  name: 'Cyclic Sigh',
  minutes: 5,
  purpose: 'Five minutes of double-inhale, long-exhale breathing that lowers stress and lifts mood.',
  when: 'Once a day, any time — the easiest daily habit here.',
  steps: [{ type: 'breath', protocol: PROTOCOLS.cyclicSigh, cycles: 26 }],
};

/**
 * Resonance breathing: about 5.5 breaths a minute, close to the rate that
 * maximises heart-rate variability for most adults (Lehrer & Gevirtz, Front
 * Psychol 2014). Opens with a BOLT check (Patrick McKeown's Body Oxygen Level
 * Test) as a simple CO₂-tolerance gauge you can retest week to week.
 */
const RESONANCE: PillarSession = {
  kind: 'resonance',
  name: 'Resonance',
  minutes: 6,
  purpose: 'Slow, even breathing at about 6 breaths a minute that calms the nervous system. Opens with a breath-hold check you can track.',
  when: 'Evenings to wind down, or any time you feel tense.',
  steps: [
    {
      type: 'move',
      title: 'BOLT check',
      cue: 'Breathe normally, exhale normally, pinch your nose and count seconds until the FIRST urge to breathe. Under 20 s: work on slow nasal breathing; 40 s is the goal.',
      seconds: 60,
    },
    { type: 'breath', protocol: PROTOCOLS.coherent, cycles: 27 },
  ],
};

/**
 * Non-sleep deep rest / yoga nidra: a guided body scan on a long exhale.
 * Yoga nidra practice improves sleep quality and lowers perceived stress
 * (e.g. Datta et al., Sleep Med 2017; Moszeik et al., Front Psychol 2022).
 * Ten minutes, lying down — the deepest down-regulation in the library.
 */
const NSDR: PillarSession = {
  kind: 'nsdr',
  name: 'Deep Rest',
  minutes: 10,
  purpose: 'A 10-minute lying-down body scan — the deepest rest short of sleep.',
  when: 'Afternoon slump, after a bad night, or right before bed.',
  steps: [
    { type: 'breath', protocol: PROTOCOLS.extendedExhale, cycles: 5 },
    { type: 'move', title: 'Feet and calves', cue: 'Lying down, eyes closed. Notice the feet, then the calves. Let them get heavy.', seconds: 75 },
    { type: 'move', title: 'Knees, thighs, hips', cue: 'Move attention slowly upward. Nothing to fix — just notice, and let go.', seconds: 75 },
    { type: 'move', title: 'Belly and low back', cue: 'Feel the belly rise and fall. Let the low back melt into the floor.', seconds: 75 },
    { type: 'move', title: 'Chest, shoulders, arms', cue: 'Shoulders drop away from the ears. Hands soft and heavy.', seconds: 75 },
    { type: 'move', title: 'Jaw, face, eyes', cue: 'Unclench the jaw. Soften the space between the eyebrows.', seconds: 60 },
    { type: 'move', title: 'Whole body', cue: 'Feel the whole body at once, breathing by itself. Rest here.', seconds: 90 },
  ],
};

/**
 * Mental skills: focus, rehearsal, and an if-then plan. Attention training on
 * the breath plus imagery of a perfect rep (Ranganathan et al. 2004) and an
 * implementation intention (Gollwitzer & Sheeran 2006). See `src/mind/cues.ts`.
 */
const FOCUS: PillarSession = {
  kind: 'focus',
  name: 'Focus',
  minutes: 6,
  purpose: 'Breath counting, rehearsing your main lift, and an if-then plan.',
  when: 'Before a big lift, a hard day at work, or anything that needs your full attention.',
  steps: [
    { type: 'breath', protocol: PROTOCOLS.box, cycles: 6 },
    {
      type: 'move',
      title: 'Count to ten',
      cue: 'Count each exhale, 1 to 10. Lost count? No judgment — start again at 1. That return IS the rep.',
      seconds: 90,
    },
    {
      type: 'move',
      title: 'Rehearse a perfect rep',
      cue: 'Eyes closed. See your main lift from your own eyes: set-up, brace, the bar moving fast, the lockout. Feel it.',
      seconds: 90,
    },
    {
      type: 'move',
      title: 'If–then plan',
      cue: 'Name the one thing most likely to derail today. Finish the sentence: “If that happens, then I will…”',
      seconds: 45,
    },
  ],
};


const RESET: PillarSession = {
  kind: 'reset',
  name: 'Reset',
  minutes: 6,
  purpose: 'A fast mix of calming breaths that brings you down quickly.',
  when: "When you're stressed, wired, or angry and need to settle in a few minutes.",
  steps: [
    { type: 'breath', protocol: PROTOCOLS.physiologicalSigh, cycles: 5 },
    { type: 'breath', protocol: PROTOCOLS.box, cycles: 6 },
    {
      type: 'move',
      title: 'Humming exhale',
      cue: 'Hum quietly on every exhale. Feel the vibration in your chest and throat.',
      seconds: 90,
    },
    { type: 'breath', protocol: PROTOCOLS.fourSevenEight, cycles: 3 },
    { type: 'breath', protocol: PROTOCOLS.coherent, cycles: 5 },
  ],
};

const REALIGN: PillarSession = {
  kind: 'realign',
  name: 'Realign',
  minutes: 7,
  purpose: 'Corrective moves for the hip tilt and rolled shoulders.',
  when: 'When your posture scan shows a tilt, or about 3 times a week.',
  steps: [
    {
      type: 'move',
      title: '90/90 Hip Lift',
      cue: 'Feet on a wall, hips and knees at 90°. Exhale fully, flatten the low back, lift the tailbone an inch.',
      seconds: 90,
    },
    { type: 'breath', protocol: PROTOCOLS.extendedExhale, cycles: 3 },
    {
      type: 'move',
      title: 'Dead Bug',
      cue: 'Low back pressed flat. Long exhale as the opposite arm and leg lower. Stop where the back wants to lift.',
      seconds: 90,
    },
    {
      type: 'move',
      title: 'Half-Kneeling Pallof Press',
      cue: 'Down-side glute on. Press out on the exhale, resist the twist. Both sides.',
      seconds: 90,
    },
    {
      type: 'move',
      title: 'Open Book Rotation',
      cue: 'Knees stacked, sweep the top arm open on the exhale. Both sides.',
      seconds: 60,
    },
  ],
};

const UNLOCK: PillarSession = {
  kind: 'unlock',
  name: 'Unlock',
  minutes: 7,
  purpose: 'Joint circles and stretches for hips, spine, shoulders and ankles.',
  when: "When you're stiff, on rest days, or as a warm-up before a home session.",
  steps: [
    { type: 'move', title: 'CARs — Neck', cue: 'Slow controlled circles, both directions.', seconds: 30 },
    {
      type: 'move',
      title: 'CARs — Shoulders',
      cue: 'Largest pain-free circle you can draw, both directions.',
      seconds: 45,
    },
    {
      type: 'move',
      title: '90/90 Hip Switches',
      cue: 'Rotate from one 90/90 position to the other, unhurried.',
      seconds: 60,
    },
    {
      type: 'move',
      title: 'Thoracic Opener',
      cue: 'Side-lying, sweep the top arm open following it with your eyes. Both sides.',
      seconds: 60,
    },
    {
      type: 'move',
      title: 'Ankle Dorsiflexion Rocks',
      cue: 'Knee tracks over the toes without the heel lifting. Both sides.',
      seconds: 60,
    },
    { type: 'move', title: 'Hip CARs', cue: 'Slow controlled circles at the hip, both sides.', seconds: 60 },
    {
      type: 'move',
      title: 'Couch Stretch',
      cue: 'Back knee against a wall or couch, squeeze that glute, ribs down. Front of the hip opens — the direct answer to a forward-tilted pelvis. Both sides.',
      seconds: 90,
    },
    {
      type: 'move',
      title: 'Deep Squat Hold',
      cue: 'Hold something for balance, sink as low as feels good, breathe into the back. Hold, don’t bounce.',
      seconds: 45,
    },
  ],
};

const GROUND: PillarSession = {
  kind: 'ground',
  name: 'Ground',
  minutes: 5,
  purpose: 'Five gentle minutes on the floor.',
  when: "On a day you can't train — it keeps the habit alive without adding fatigue.",
  steps: [
    { type: 'breath', protocol: PROTOCOLS.coherent, cycles: 3 },
    { type: 'move', title: 'Cat-Cow', cue: 'Follow the breath, not the clock. Inhale arch, exhale round.', seconds: 45 },
    {
      type: 'move',
      title: "Child's Pose",
      cue: 'Forehead down, let the low back breathe wide into the floor.',
      seconds: 60,
    },
    { type: 'move', title: 'Supine Knee Hugs', cue: 'Pull both knees in gently, exhale as you pull.', seconds: 45 },
    { type: 'move', title: 'Dead Bug, slow', cue: 'No rush. Low back stays flat.', seconds: 60 },
    { type: 'breath', protocol: PROTOCOLS.extendedExhale, cycles: 2 },
  ],
};

/** Sessions grouped by when you'd reach for them — the Recover tab's layout. */
export const PILLAR_GROUPS: { title: string; kinds: PillarSession['kind'][] }[] = [
  { title: 'Daily', kinds: ['pelvic', 'sigh'] },
  { title: 'Before you train', kinds: ['activate', 'unlock'] },
  { title: 'Fix your posture', kinds: ['realign'] },
  { title: 'Calm down', kinds: ['reset', 'resonance'] },
  { title: 'Recover deeper', kinds: ['nsdr'] },
  { title: 'Mind', kinds: ['focus'] },
  { title: 'No energy to train', kinds: ['ground'] },
];

export const PILLAR_SESSIONS: Record<PillarSession['kind'], PillarSession> = {
  activate: ACTIVATE,
  reset: RESET,
  sigh: SIGH,
  resonance: RESONANCE,
  nsdr: NSDR,
  focus: FOCUS,
  // Level 0; the live session is built from practice count — see App.
  pelvic: pelvicFloorSession(0),
  realign: REALIGN,
  unlock: UNLOCK,
  ground: GROUND,
};
