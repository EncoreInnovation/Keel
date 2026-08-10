/**
 * KEEL domain model.
 *
 * Everything in `src/engine` is pure: plain data in, plain data out, no I/O and
 * no React. That is what makes the programming logic testable and what keeps
 * the app fully functional offline.
 */

/* ------------------------------------------------------------------ *
 * Muscles
 * ------------------------------------------------------------------ */

/**
 * Fifteen addressable muscle groups. Fourteen give the per-muscle recovery
 * granularity that makes a body map worth looking at (broad "legs"/"push"
 * buckets don't); neck is the fifteenth — it matters for both the wrestler
 * build and forward-head posture.
 */
export const MUSCLES = [
  'chest',
  'upperBack',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'lowerBack',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'adductors',
  'neck',
] as const;

export type Muscle = (typeof MUSCLES)[number];

export type MuscleMap = Record<Muscle, number>;

/** Muscles whose fatigue clears slowly. Drives the decay half-life. */
export const LARGE_MUSCLES: ReadonlySet<Muscle> = new Set<Muscle>([
  'chest',
  'upperBack',
  'lats',
  'glutes',
  'quads',
  'hamstrings',
  'lowerBack',
]);

/* ------------------------------------------------------------------ *
 * Movement vocabulary
 * ------------------------------------------------------------------ */

export const MOVEMENT_PATTERNS = [
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'rotation',
  'antiRotation',
  'antiExtension',
  'bridge',
  'neck',
  'gait',
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'kettlebell',
  'band',
  'suspension',
  'pullupBar',
  'bench',
  'mat',
  'wall',
  'chair',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** Joints that can be flagged as cranky, suppressing exercises that load them. */
export const JOINTS = ['knee', 'hip', 'lowBack', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck'] as const;
export type Joint = (typeof JOINTS)[number];

/**
 * How an exercise gets harder. This is the crux of home training: without a
 * weight stack, most progression is `ladder`, not `load`.
 */
export type LoadType = 'external' | 'bodyweight' | 'band' | 'time';

/** Ground-reaction impact. Gates plyometric work behind earned joint tolerance. */
export type ImpactLevel = 'none' | 'low' | 'moderate' | 'high';

export type ExperienceLevel = 'novice' | 'intermediate' | 'advanced';

/* ------------------------------------------------------------------ *
 * Exercise
 * ------------------------------------------------------------------ */

export interface Exercise {
  id: string;
  name: string;

  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  patterns: MovementPattern[];
  equipment: Equipment[];

  loadType: LoadType;
  impact: ImpactLevel;
  level: ExperienceLevel;

  /** True when the movement is performed one side at a time — logged per side. */
  unilateral: boolean;

  /**
   * 0..1 fit for the wrestler-build goal: thick upper back, traps, delts,
   * posterior chain, and the compound patterns that carry them.
   */
  goalFit: number;

  /**
   * 0..1 value for the corrective agenda — repositioning, anti-rotation,
   * offset loading, scapular control. Directly counteracts the postural
   * pattern rather than merely avoiding aggravating it.
   */
  correctiveFit: number;

  /** Joints this movement meaningfully loads; cross-referenced with user flags. */
  jointLoad: Joint[];

  /**
   * Ladder edge. Points at the id of the easier rung directly below this one,
   * which is the single source of truth for the progression graph — the
   * upward edges are derived by inverting it, so the two can never disagree.
   */
  progressionOf?: string;

  instructions: string[];
  /** Short breath cue shown during the set — ties the pillar work into lifting. */
  breathCue?: string;
  /** e.g. "3-1-1-0" (eccentric-pause-concentric-pause) */
  tempo?: string;

  images: string[];
  /** Hand-picked technique demo. Rendered via youtube-nocookie, rel=0. */
  videoUrl?: string;
}

/* ------------------------------------------------------------------ *
 * Logging
 * ------------------------------------------------------------------ */

export type Side = 'left' | 'right' | 'both';

export type SkipReason = 'pain' | 'time' | 'equipment' | 'other';

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** Index of the set within its exercise, 0-based. */
  setIndex: number;
  side: Side;

  weight: number; // lbs; 0 for unloaded bodyweight work
  reps: number;
  /** Rate of perceived exertion, 6..10. The engine's most important input. */
  rpe: number;

  completedAt: number; // epoch ms
  skipped?: boolean;
  skipReason?: SkipReason;
}

export interface SessionLog {
  id: string;
  blockId: string;
  weekNumber: number; // 1-based
  dayId: string;
  startedAt: number;
  completedAt?: number;
  sets: SetLog[];
  /** Pre-session readiness, 1..5. Feeds systemic fatigue. */
  readiness?: number;
  notes?: string;
}

/* ------------------------------------------------------------------ *
 * Pillar micro-sessions — breath, nervous-system, mobility, corrective
 * ------------------------------------------------------------------ */

export const PILLAR_KINDS = ['reset', 'realign', 'unlock', 'ground'] as const;
export type PillarKind = (typeof PILLAR_KINDS)[number];

export interface PillarLog {
  id: string;
  kind: PillarKind;
  startedAt: number;
  completedAt?: number;
  /** 1..5 self-rated activation, captured immediately before and after. */
  preActivation?: number;
  postActivation?: number;
}

/* ------------------------------------------------------------------ *
 * Body metrics — weight and tape measurements
 * ------------------------------------------------------------------ */

export const MEASUREMENT_SITES = ['waist', 'chest', 'hips', 'neck'] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

export interface BodyMetricLog {
  id: string;
  at: number;
  /** lbs. */
  weight?: number;
  /** Inches, keyed by site. Sparse — log only what you measured that day. */
  measurements?: Partial<Record<MeasurementSite, number>>;
  notes?: string;
}

/* ------------------------------------------------------------------ *
 * Posture scan
 *
 * A tracker, not a diagnosis: a single 2D photo can't measure true pelvic
 * tilt, and camera angle alone can swing these numbers more than real change
 * will. The value is in the delta across repeated, same-conditions captures,
 * not in any one reading's absolute number.
 * ------------------------------------------------------------------ */

export interface PostureAngles {
  /** Degrees off horizontal. Positive = right shoulder higher. */
  shoulderTilt: number;
  /** Degrees off horizontal. Positive = right hip higher. */
  hipTilt: number;
  /** Signed midline offset of shoulders vs. hips, as a fraction of shoulder width. Positive = shifted right. */
  lateralShift: number;
  /** Side-view only: ear-to-shoulder horizontal offset, as a fraction of shoulder width. */
  forwardHead?: number;
  /** Side-view only: degrees of shoulder-over-hip forward lean. */
  trunkLean?: number;
}

export type PostureView = 'front' | 'side';

export interface PostureLog {
  id: string;
  at: number;
  angles: PostureAngles;
  /** Which views contributed a photo — drives which angle fields are meaningful. */
  views: PostureView[];
}

/* ------------------------------------------------------------------ *
 * Conditioning
 * ------------------------------------------------------------------ */

export type ConditioningKind = 'run' | 'walk' | 'bike' | 'circuit' | 'hiit' | 'other';

export interface ConditioningLog {
  id: string;
  kind: ConditioningKind;
  startedAt: number;
  durationSec: number;
  distanceM?: number;
  avgHr?: number;
  /** 1..10 subjective effort; used when heart rate is absent. */
  effort: number;
  impact: ImpactLevel;
  source: 'strava' | 'manual';
  externalId?: string;
}

/* ------------------------------------------------------------------ *
 * Programming
 * ------------------------------------------------------------------ */

export type SlotRole = 'primary' | 'secondary' | 'accessory' | 'finisher';

export interface Slot {
  id: string;
  role: SlotRole;
  /** The slot demands a pattern; the selector picks the exercise that fills it. */
  pattern: MovementPattern;
  sets: number;
  repMin: number;
  repMax: number;
  /** Target RPE. Autoregulation measures deviation from this. */
  targetRpe: number;
  restSec: number;
  /** Primary slots lock their exercise for the whole block. */
  locked: boolean;
  /** Bias the selector toward corrective value in this slot. */
  preferCorrective?: boolean;
}

export interface DayTemplate {
  id: string;
  name: string;
  slots: Slot[];
}

export interface Block {
  id: string;
  name: string;
  weeks: number;
  /** Index of the deload week, 1-based. Always the final week. */
  deloadWeek: number;
  days: DayTemplate[];
  startedAt: number;
  /** Exercise chosen for each locked slot, held constant across the block. */
  lockedAssignments: Record<string, string>; // slotId -> exerciseId
}

/* ------------------------------------------------------------------ *
 * Prescription — what the player actually renders
 * ------------------------------------------------------------------ */

export interface PrescribedSet {
  setIndex: number;
  weight: number;
  repTarget: number;
  targetRpe: number;
  side: Side;
}

export interface PrescribedExercise {
  slotId: string;
  role: SlotRole;
  exercise: Exercise;
  sets: PrescribedSet[];
  restSec: number;
  /** Populated from history so the player can show "last time" ghosts. */
  lastPerformance?: { weight: number; reps: number; rpe: number; at: number };
  /**
   * Set when the recovery guard cut this exercise back. Surfaced in the player
   * so a lighter day reads as a deliberate call rather than the app losing
   * track of what you lifted last week.
   */
  reducedForRecovery?: boolean;
}

export interface PrescribedSession {
  blockId: string;
  weekNumber: number;
  dayId: string;
  dayName: string;
  isDeload: boolean;
  exercises: PrescribedExercise[];
  estimatedMinutes: number;
}

/* ------------------------------------------------------------------ *
 * User profile
 * ------------------------------------------------------------------ */

export interface UserProfile {
  bodyweight: number;
  level: ExperienceLevel;
  availableEquipment: Equipment[];
  /**
   * Real increments of the user's adjustable dumbbells. A program that says
   * "add 2.5 lb" to someone whose dumbbells jump in 5s is simply broken.
   */
  dumbbellIncrement: number;
  flaggedJoints: Joint[];
  /** Highest impact level currently unlocked. Earned, not chosen. */
  impactCeiling: ImpactLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  /** Drives the countdown and Block 1's tuning. */
  goalDate?: number;
}
