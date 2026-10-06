/**
 * Day-specific copy for the Arrive primer and the Downshift cooldown, keyed by
 * the block's day ids. Lives outside the components so a test can assert every
 * day in the template has its own entry — a split rename once left every day
 * silently falling back to the same generic copy.
 */

export interface PhaseCopy {
  title: string;
  lines: string[];
}

export const PRIMER_COPY: Record<string, PhaseCopy> = {
  'strength-a': {
    title: 'Squat & press primer',
    lines: [
      'Goblet-style bodyweight squats, slow, pause at the bottom.',
      'Arm circles, then a few wall slides.',
      'Exhale fully at the bottom of each rep — ribs down, brace, stand.',
    ],
  },
  'strength-b': {
    title: 'Hinge & pull primer',
    lines: [
      'Hip hinge with a dowel or broomstick, slow.',
      'Dead hang or band pull-aparts, 20 seconds.',
      'Hamstrings long, spine quiet — the hips do the work.',
    ],
  },
  build: {
    title: 'Build primer',
    lines: [
      'Arm circles, both directions, then band pull-aparts.',
      'A few incline push-ups and bodyweight squats.',
      'Smooth reps today — chase the squeeze, not the weight.',
    ],
  },
  athletic: {
    title: 'Athletic primer',
    lines: [
      'Ankle rocks, then 20 seconds of easy pogo-in-place on the toes.',
      'Hip CARs, both sides.',
      'Quiet landings: knees track over toes, stick every rep.',
    ],
  },
};

export const COOLDOWN_COPY: Record<string, PhaseCopy> = {
  'strength-a': {
    title: 'Cool down · Hips & chest',
    lines: ['Kneeling hip flexor stretch, then a doorway chest stretch.', 'Let the exhale be longer than the inhale.'],
  },
  'strength-b': {
    title: 'Cool down · Hamstrings & lats',
    lines: ['Standing hamstring stretch, then a lat stretch on a doorframe.', 'No bouncing — hold, breathe, ease in.'],
  },
  build: {
    title: 'Cool down · Upper body',
    lines: ['Doorway chest stretch, then child’s pose.', 'Let the shoulders drop away from the ears.'],
  },
  athletic: {
    title: 'Cool down · Calves & hips',
    lines: ['Wall calf stretch, both sides, then a deep squat hold.', 'Slow nasal breathing until the heart rate settles.'],
  },
};

/** Before this hour, the primer adds a spine warm-up line. */
export const EARLY_MORNING_HOUR = 10;

/**
 * Intervertebral discs take on fluid overnight and are measurably stiffer and
 * more vulnerable to bending load for the first hour or so after waking
 * (Adams et al., Spine 1987; Snook et al., Spine 1998 — avoiding early-morning
 * lumbar flexion reduced back pain). Early sessions therefore warm the spine
 * before anything loads it.
 */
const MORNING_LINE = 'Early start: two easy minutes of walking or cat-cow first — the spine is stiffest right after waking.';

export function primerFor(dayId: string, hour: number): PhaseCopy {
  const base = PRIMER_COPY[dayId] ?? PRIMER_COPY['strength-a']!;
  return hour < EARLY_MORNING_HOUR ? { ...base, lines: [MORNING_LINE, ...base.lines] } : base;
}

export function cooldownFor(dayId: string): PhaseCopy {
  return COOLDOWN_COPY[dayId] ?? COOLDOWN_COPY['strength-a']!;
}
