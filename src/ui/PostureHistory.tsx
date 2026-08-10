/**
 * Posture history — the trend view.
 *
 * A single reading means little on its own; what matters is whether the
 * numbers move across repeated, same-conditions captures. This screen shows
 * each logged angle next to its delta from the previous scan, and nothing
 * else — no score, no verdict, no "good/bad" framing. That restraint is
 * deliberate: a 2D photo can't diagnose you, and pretending otherwise with a
 * confident-looking number would be worse than not measuring at all.
 */

import { useEffect, useState } from 'react';
import { getPostureLogs } from '../storage/repository';
import type { PostureAngles, PostureLog } from '../engine/types';

export interface PostureHistoryProps {
  onBack: () => void;
  onNewScan: () => void;
}

const ANGLE_FIELDS: { key: keyof PostureAngles; label: string; unit: string; views: number }[] = [
  { key: 'shoulderTilt', label: 'Shoulder tilt', unit: '°', views: 1 },
  { key: 'hipTilt', label: 'Hip tilt', unit: '°', views: 1 },
  { key: 'lateralShift', label: 'Lateral shift', unit: '%', views: 1 },
  { key: 'forwardHead', label: 'Forward head', unit: '%', views: 1 },
  { key: 'trunkLean', label: 'Trunk lean', unit: '°', views: 1 },
];

function formatValue(key: keyof PostureAngles, value: number): string {
  if (key === 'lateralShift' || key === 'forwardHead') return `${Math.round(value * 100)}%`;
  return `${value.toFixed(1)}°`;
}

function formatDelta(key: keyof PostureAngles, delta: number): string {
  const sign = delta > 0 ? '+' : '';
  if (key === 'lateralShift' || key === 'forwardHead') return `${sign}${Math.round(delta * 100)}%`;
  return `${sign}${delta.toFixed(1)}°`;
}

export function PostureHistory({ onBack, onNewScan }: PostureHistoryProps) {
  const [logs, setLogs] = useState<PostureLog[] | undefined>();

  useEffect(() => {
    void getPostureLogs().then(setLogs);
  }, []);

  if (!logs) {
    return <div className="today today--loading">Loading…</div>;
  }

  return (
    <div className="phase-screen posture-history">
      <div className="phase-screen__eyebrow">Posture</div>
      <p className="placeholder__body">
        A tracker, not a diagnosis. These numbers move with real change and with camera angle
        alike — same spot, same lighting, same stance each time is what makes the trend mean
        something.
      </p>

      <button className="btn btn--hero" onClick={onNewScan}>
        New scan
      </button>

      {logs.length === 0 ? (
        <p className="placeholder__body">No scans yet.</p>
      ) : (
        <div className="posture-history__list">
          {[...logs].reverse().map((log, i) => {
            const previous = logs[logs.length - 2 - i];
            return (
              <div key={log.id} className="posture-history__entry">
                <div className="posture-history__date">{new Date(log.at).toLocaleDateString()}</div>
                {ANGLE_FIELDS.filter((f) => log.angles[f.key] !== undefined).map((f) => {
                  const value = log.angles[f.key]!;
                  const prevValue = previous?.angles[f.key];
                  return (
                    <div key={f.key} className="posture-history__row">
                      <span className="posture-history__row-label">{f.label}</span>
                      <span data-numeric>{formatValue(f.key, value)}</span>
                      {prevValue !== undefined && (
                        <span className="posture-history__row-delta" data-numeric>
                          {formatDelta(f.key, value - prevValue)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
