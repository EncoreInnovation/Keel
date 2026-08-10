/**
 * MediaPipe Pose Landmarker wrapper — the one impure module in `src/posture`.
 *
 * Everything that can be pure lives in `landmarks.ts` instead; this file's
 * only job is turning a photo into 33 landmarks. The WASM runtime and the
 * pose model are vendored under `public/mediapipe/` (not fetched from a
 * CDN) specifically so a posture scan works with no network, matching the
 * PWA's offline goal — this is the one feature in the app with a real binary
 * asset dependency, and it shouldn't be the one exception to "works on the
 * gym floor with no signal."
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from './landmarks';

const WASM_BASE_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/models/pose_landmarker_lite.task';

let landmarkerPromise: Promise<PoseLandmarker> | undefined;

function getLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE_PATH).then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      }),
    );
  }
  return landmarkerPromise;
}

/** Load a File/Blob into a decoded <img> element, ready for detection. */
export function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

/**
 * Detect a single pose in a photo. Returns `undefined` when no person is
 * confidently detected — the caller's job is to tell the user to retake the
 * photo, not to guess at angles from noise.
 */
export async function detectPose(image: HTMLImageElement): Promise<Landmark[] | undefined> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const landmarks = result.landmarks[0];
  if (!landmarks || landmarks.length === 0) return undefined;
  return landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }));
}
