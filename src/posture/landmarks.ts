/**
 * Pure posture-angle math over pose landmarks.
 *
 * Deliberately independent of MediaPipe's runtime — this module takes a
 * plain landmark shape and returns plain numbers, so every formula here is
 * unit-testable with synthetic coordinates and never needs a model, a WASM
 * runtime, or a browser to verify.
 *
 * A note on left/right: MediaPipe labels landmarks by the *subject's* own
 * anatomical side, inferred from the pose itself — not by which half of the
 * image they land in. In an ordinary (non-mirrored) photo of someone facing
 * the camera, their right shoulder appears on the left side of the frame.
 * Every formula below is written to stay correct regardless of that mirror
 * flip, by projecting onto vectors derived from the landmarks themselves
 * rather than assuming which screen-x is "right."
 *
 * What this is: a repeatable, same-conditions measurement whose *trend*
 * across weeks is the signal. What this isn't: a diagnosis. A single 2D
 * photo can't see true pelvic rotation through clothing, and camera angle
 * alone can swing these numbers more than real change will.
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** BlazePose 33-point indices used here. */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Euclidean distance in normalized image coordinates. */
function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface FrontAngles {
  shoulderTilt: number;
  hipTilt: number;
  lateralShift: number;
}

/**
 * Angle of a left/right landmark pair off horizontal, in degrees. Positive
 * means the right-side landmark sits higher (smaller y — image y increases
 * downward) than the left.
 *
 * Uses the *absolute* horizontal extent as the atan2 run, not the signed
 * `right.x - left.x`. A normal (non-mirrored) frontal photo has the
 * anatomical right landmark sitting at a *smaller* image-x than the left
 * one — the everyday mirror-image flip of facing someone. Feeding that
 * negative run into atan2 wraps the result toward ±180° instead of a small
 * tilt angle. The vertical term alone (`left.y - right.y`) already carries
 * the correct sign for "which side is higher" and needs no help from x.
 */
function pairTilt(left: Landmark, right: Landmark): number {
  return degrees(Math.atan2(left.y - right.y, Math.abs(right.x - left.x)));
}

/**
 * Front-view angles: shoulder tilt, hip tilt, and the lateral shift between
 * the shoulder midline and the hip midline.
 *
 * The shift is computed by projecting the hip-to-shoulder midpoint offset
 * onto the shoulder line's own direction vector, then normalizing by
 * shoulder width — so "positive" always means "hips shifted toward the
 * subject's right," independent of how the photo happens to be mirrored.
 */
export function computeFrontAngles(landmarks: Landmark[]): FrontAngles {
  const ls = landmarks[LM.leftShoulder]!;
  const rs = landmarks[LM.rightShoulder]!;
  const lh = landmarks[LM.leftHip]!;
  const rh = landmarks[LM.rightHip]!;

  const shoulderWidth = dist(ls, rs);
  const rightVec = { x: rs.x - ls.x, y: rs.y - ls.y };

  const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const offset = { x: hipMid.x - shoulderMid.x, y: hipMid.y - shoulderMid.y };

  const lateralShift =
    shoulderWidth > 0 ? (offset.x * rightVec.x + offset.y * rightVec.y) / (shoulderWidth * shoulderWidth) : 0;

  return {
    shoulderTilt: pairTilt(ls, rs),
    hipTilt: pairTilt(lh, rh),
    lateralShift,
  };
}

export interface SideAngles {
  forwardHead: number;
  trunkLean: number;
}

/** Pick whichever side's landmarks MediaPipe is more confident about — the one facing the camera in profile. */
function nearSide(landmarks: Landmark[]): 'left' | 'right' {
  const leftScore =
    (landmarks[LM.leftEar]?.visibility ?? 0) +
    (landmarks[LM.leftShoulder]?.visibility ?? 0) +
    (landmarks[LM.leftHip]?.visibility ?? 0);
  const rightScore =
    (landmarks[LM.rightEar]?.visibility ?? 0) +
    (landmarks[LM.rightShoulder]?.visibility ?? 0) +
    (landmarks[LM.rightHip]?.visibility ?? 0);
  return rightScore >= leftScore ? 'right' : 'left';
}

/**
 * Side-view angles: forward head posture and trunk lean, both signed
 * positive in the direction the subject is facing.
 *
 * Facing direction is inferred from the nose sitting forward of the ear
 * along x — in profile, the nose always leads. Everything else is projected
 * onto that direction so the sign is meaningful regardless of which way the
 * subject stood relative to the camera.
 */
export function computeSideAngles(landmarks: Landmark[]): SideAngles {
  const side = nearSide(landmarks);
  const ear = landmarks[side === 'left' ? LM.leftEar : LM.rightEar]!;
  const shoulder = landmarks[side === 'left' ? LM.leftShoulder : LM.rightShoulder]!;
  const hip = landmarks[side === 'left' ? LM.leftHip : LM.rightHip]!;
  const nose = landmarks[LM.nose]!;

  const facing = Math.sign(nose.x - ear.x) || 1;
  const torsoLength = dist(shoulder, hip);

  const forwardHead = torsoLength > 0 ? ((ear.x - shoulder.x) * facing) / torsoLength : 0;

  const horizontalLean = (shoulder.x - hip.x) * facing;
  const verticalRise = hip.y - shoulder.y; // positive: shoulder sits above hip, as expected upright
  const trunkLean = degrees(Math.atan2(horizontalLean, verticalRise));

  return { forwardHead, trunkLean };
}
