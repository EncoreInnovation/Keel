/**
 * Posture angle math, tested with synthetic landmarks — no MediaPipe, no
 * WASM, no network. These are the formulas most likely to have a subtle
 * sign or mirroring bug, since "left/right on screen" and "left/right on
 * the subject" disagree in an ordinary frontal photo.
 */

import { describe, expect, it } from 'vitest';
import { computeFrontAngles, computeSideAngles, LM, type Landmark } from '../src/posture/landmarks';

function landmarks(overrides: Partial<Record<number, Partial<Landmark>>>): Landmark[] {
  const base: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const arr = Array.from({ length: 33 }, () => ({ ...base }));
  for (const [idx, patch] of Object.entries(overrides)) {
    arr[Number(idx)] = { ...arr[Number(idx)]!, ...patch };
  }
  return arr;
}

describe('computeFrontAngles — shoulder and hip tilt', () => {
  it('is zero for level shoulders and hips', () => {
    const lm = landmarks({
      [LM.leftShoulder]: { x: 0.6, y: 0.3 },
      [LM.rightShoulder]: { x: 0.4, y: 0.3 },
      [LM.leftHip]: { x: 0.6, y: 0.6 },
      [LM.rightHip]: { x: 0.4, y: 0.6 },
    });
    const { shoulderTilt, hipTilt } = computeFrontAngles(lm);
    expect(shoulderTilt).toBeCloseTo(0, 5);
    expect(hipTilt).toBeCloseTo(0, 5);
  });

  it('is positive when the right shoulder sits higher, in a normal (unmirrored) frontal photo', () => {
    // Ordinary frontal photo: the subject's right shoulder appears at a
    // *smaller* image-x than the left one (facing the camera).
    const lm = landmarks({
      [LM.leftShoulder]: { x: 0.6, y: 0.35 },
      [LM.rightShoulder]: { x: 0.4, y: 0.25 }, // smaller y = higher on screen
    });
    expect(computeFrontAngles(lm).shoulderTilt).toBeGreaterThan(0);
  });

  it('is negative when the left shoulder sits higher', () => {
    const lm = landmarks({
      [LM.leftShoulder]: { x: 0.6, y: 0.2 },
      [LM.rightShoulder]: { x: 0.4, y: 0.35 },
    });
    expect(computeFrontAngles(lm).shoulderTilt).toBeLessThan(0);
  });

  it('gives the same tilt whether the photo is mirrored or not', () => {
    const normal = landmarks({
      [LM.leftShoulder]: { x: 0.6, y: 0.35 },
      [LM.rightShoulder]: { x: 0.4, y: 0.25 },
    });
    // Flip every x — same physical pose, as if captured with the opposite
    // camera handedness. Anatomical labels (left/right) stay attached to
    // the same physical shoulders, exactly as MediaPipe would report them.
    const mirrored = landmarks({
      [LM.leftShoulder]: { x: 1 - 0.6, y: 0.35 },
      [LM.rightShoulder]: { x: 1 - 0.4, y: 0.25 },
    });
    expect(computeFrontAngles(mirrored).shoulderTilt).toBeCloseTo(computeFrontAngles(normal).shoulderTilt, 5);
  });

  it('computes a sensible magnitude for a known angle', () => {
    // dy=0.1 over dx=0.2 -> atan(0.1/0.2) ≈ 26.57°
    const lm = landmarks({
      [LM.leftShoulder]: { x: 0.6, y: 0.35 },
      [LM.rightShoulder]: { x: 0.4, y: 0.25 },
    });
    expect(computeFrontAngles(lm).shoulderTilt).toBeCloseTo(26.565, 2);
  });
});

describe('computeFrontAngles — lateral shift', () => {
  const level = {
    [LM.leftShoulder]: { x: 0.6, y: 0.3 },
    [LM.rightShoulder]: { x: 0.4, y: 0.3 },
  };

  it('is zero when hips sit directly under the shoulder midline', () => {
    const lm = landmarks({ ...level, [LM.leftHip]: { x: 0.6, y: 0.6 }, [LM.rightHip]: { x: 0.4, y: 0.6 } });
    expect(computeFrontAngles(lm).lateralShift).toBeCloseTo(0, 5);
  });

  it('is positive when the hips shift toward the subject\'s right', () => {
    // Right shoulder is at the smaller x (0.4) — that's "the subject's
    // right direction" in this frame. Shifting both hips toward smaller x
    // is a shift toward the subject's right.
    const lm = landmarks({ ...level, [LM.leftHip]: { x: 0.55, y: 0.6 }, [LM.rightHip]: { x: 0.35, y: 0.6 } });
    expect(computeFrontAngles(lm).lateralShift).toBeGreaterThan(0);
  });

  it('is negative when the hips shift toward the subject\'s left', () => {
    const lm = landmarks({ ...level, [LM.leftHip]: { x: 0.65, y: 0.6 }, [LM.rightHip]: { x: 0.45, y: 0.6 } });
    expect(computeFrontAngles(lm).lateralShift).toBeLessThan(0);
  });

  it('gives the same signed shift whether the photo is mirrored or not', () => {
    const normal = landmarks({ ...level, [LM.leftHip]: { x: 0.55, y: 0.6 }, [LM.rightHip]: { x: 0.35, y: 0.6 } });
    const mirrored = landmarks({
      [LM.leftShoulder]: { x: 1 - 0.6, y: 0.3 },
      [LM.rightShoulder]: { x: 1 - 0.4, y: 0.3 },
      [LM.leftHip]: { x: 1 - 0.55, y: 0.6 },
      [LM.rightHip]: { x: 1 - 0.35, y: 0.6 },
    });
    expect(computeFrontAngles(mirrored).lateralShift).toBeCloseTo(computeFrontAngles(normal).lateralShift, 5);
  });
});

describe('computeSideAngles', () => {
  // Right-facing profile: nose in front of ear (larger x), the whole right
  // side is the near/visible side.
  function rightProfile(overrides: Partial<Record<number, Partial<Landmark>>> = {}): Landmark[] {
    return landmarks({
      [LM.nose]: { x: 0.55, y: 0.2 },
      [LM.rightEar]: { x: 0.5, y: 0.2, visibility: 1 },
      [LM.leftEar]: { x: 0.5, y: 0.2, visibility: 0 },
      [LM.rightShoulder]: { x: 0.5, y: 0.35, visibility: 1 },
      [LM.leftShoulder]: { x: 0.5, y: 0.35, visibility: 0 },
      [LM.rightHip]: { x: 0.5, y: 0.6, visibility: 1 },
      [LM.leftHip]: { x: 0.5, y: 0.6, visibility: 0 },
      ...overrides,
    });
  }

  it('reports zero forward head and zero trunk lean for a stacked, upright pose', () => {
    const lm = rightProfile();
    const { forwardHead, trunkLean } = computeSideAngles(lm);
    expect(forwardHead).toBeCloseTo(0, 5);
    expect(trunkLean).toBeCloseTo(0, 5);
  });

  it('reports positive forward head when the ear sits ahead of the shoulder', () => {
    // Nose must stay ahead of the ear (facing direction), or moving the ear
    // alone flips which way "forward" is inferred to be.
    const lm = rightProfile({
      [LM.nose]: { x: 0.62, y: 0.2 },
      [LM.rightEar]: { x: 0.58, y: 0.2, visibility: 1 },
    });
    expect(computeSideAngles(lm).forwardHead).toBeGreaterThan(0);
  });

  it('reports positive trunk lean when the shoulder sits ahead of the hip', () => {
    const lm = rightProfile({ [LM.rightShoulder]: { x: 0.56, y: 0.35, visibility: 1 } });
    expect(computeSideAngles(lm).trunkLean).toBeGreaterThan(0);
  });

  it('picks the side with higher visibility as the near side', () => {
    const lm = landmarks({
      [LM.nose]: { x: 0.55, y: 0.2 },
      [LM.leftEar]: { x: 0.5, y: 0.2, visibility: 0.9 },
      [LM.rightEar]: { x: 0.5, y: 0.2, visibility: 0.1 },
      [LM.leftShoulder]: { x: 0.5, y: 0.35, visibility: 0.9 },
      [LM.rightShoulder]: { x: 0.5, y: 0.35, visibility: 0.1 },
      [LM.leftHip]: { x: 0.5, y: 0.6, visibility: 0.9 },
      [LM.rightHip]: { x: 0.5, y: 0.6, visibility: 0.1 },
    });
    // Moving only the low-confidence right shoulder should not move the
    // reading — the left side was selected as near.
    const moved = landmarks({
      [LM.nose]: { x: 0.55, y: 0.2 },
      [LM.leftEar]: { x: 0.5, y: 0.2, visibility: 0.9 },
      [LM.rightEar]: { x: 0.5, y: 0.2, visibility: 0.1 },
      [LM.leftShoulder]: { x: 0.5, y: 0.35, visibility: 0.9 },
      [LM.rightShoulder]: { x: 0.9, y: 0.9, visibility: 0.1 },
      [LM.leftHip]: { x: 0.5, y: 0.6, visibility: 0.9 },
      [LM.rightHip]: { x: 0.5, y: 0.6, visibility: 0.1 },
    });
    expect(computeSideAngles(moved)).toEqual(computeSideAngles(lm));
  });
});
