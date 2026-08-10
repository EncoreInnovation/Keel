/**
 * The four standalone micro-sessions, always one tap from Today.
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

const RESET: PillarSession = {
  kind: 'reset',
  name: 'Reset',
  minutes: 6,
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
  minutes: 5,
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
  ],
};

const GROUND: PillarSession = {
  kind: 'ground',
  name: 'Ground',
  minutes: 5,
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

export const PILLAR_SESSIONS: Record<PillarSession['kind'], PillarSession> = {
  reset: RESET,
  realign: REALIGN,
  unlock: UNLOCK,
  ground: GROUND,
};
