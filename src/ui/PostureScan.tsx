/**
 * Posture scan capture flow: front photo, then an optional side photo, then
 * a review of the computed angles before saving. Detection runs entirely
 * on-device — the photo never leaves the browser, and the model/WASM
 * runtime are vendored locally so this works with no network.
 */

import { useRef, useState } from 'react';
import { computeFrontAngles, computeSideAngles } from '../posture/landmarks';
import { detectPose, loadImage } from '../posture/detector';
import { savePostureLog } from '../storage/repository';
import type { FrontAngles, SideAngles } from '../posture/landmarks';
import type { PostureView } from '../engine/types';

type Step = 'front' | 'side' | 'review';

interface Captured<T> {
  blob: Blob;
  angles: T;
}

export interface PostureScanProps {
  onDone: () => void;
  onCancel: () => void;
}

export function PostureScan({ onDone, onCancel }: PostureScanProps) {
  const [step, setStep] = useState<Step>('front');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [front, setFront] = useState<Captured<FrontAngles> | undefined>();
  const [side, setSide] = useState<Captured<SideAngles> | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File, view: PostureView) => {
    setBusy(true);
    setError(undefined);
    try {
      const image = await loadImage(file);
      const landmarks = await detectPose(image);
      if (!landmarks) {
        setError('No person clearly detected — try a photo with your whole body in frame.');
        return;
      }
      if (view === 'front') {
        setFront({ blob: file, angles: computeFrontAngles(landmarks) });
        setStep('side');
      } else {
        setSide({ blob: file, angles: computeSideAngles(landmarks) });
        setStep('review');
      }
    } catch {
      setError('Could not read that photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!front) return;
    setBusy(true);
    const views: PostureView[] = side ? ['front', 'side'] : ['front'];
    await savePostureLog(
      {
        id: `posture-${Date.now()}`,
        at: Date.now(),
        angles: { ...front.angles, ...(side?.angles ?? {}) },
        views,
      },
      { front: front.blob, side: side?.blob },
    );
    setBusy(false);
    onDone();
  };

  const prompt =
    step === 'front'
      ? 'Front photo — stand facing the camera, whole body in frame.'
      : 'Side photo — stand in profile. Optional, but adds forward-head and trunk-lean readings.';

  return (
    <div className="phase-screen posture-scan">
      <div className="phase-screen__eyebrow">Posture Scan</div>

      {step !== 'review' ? (
        <>
          <p className="placeholder__body">{prompt}</p>
          {error && <div className="posture-scan__error">{error}</div>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file, step);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn--hero"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? 'Analyzing…' : 'Choose photo'}
          </button>
          {step === 'side' && (
            <button className="btn btn--text" onClick={() => setStep('review')}>
              Skip side photo
            </button>
          )}
        </>
      ) : (
        <>
          <div className="posture-scan__summary">
            {front && (
              <>
                <div className="posture-scan__row">
                  <span>Shoulder tilt</span>
                  <span data-numeric>{front.angles.shoulderTilt.toFixed(1)}°</span>
                </div>
                <div className="posture-scan__row">
                  <span>Hip tilt</span>
                  <span data-numeric>{front.angles.hipTilt.toFixed(1)}°</span>
                </div>
                <div className="posture-scan__row">
                  <span>Lateral shift</span>
                  <span data-numeric>{Math.round(front.angles.lateralShift * 100)}%</span>
                </div>
              </>
            )}
            {side && (
              <>
                <div className="posture-scan__row">
                  <span>Forward head</span>
                  <span data-numeric>{Math.round(side.angles.forwardHead * 100)}%</span>
                </div>
                <div className="posture-scan__row">
                  <span>Trunk lean</span>
                  <span data-numeric>{side.angles.trunkLean.toFixed(1)}°</span>
                </div>
              </>
            )}
          </div>
          <button className="btn btn--hero" disabled={busy} onClick={() => void handleSave()}>
            Save
          </button>
        </>
      )}

      <button className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
