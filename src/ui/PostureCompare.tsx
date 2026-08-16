/**
 * Before/after photo comparison — a slider between any two posture scans.
 *
 * The trend view (`PostureHistory`) already shows whether the numbers are
 * moving; this answers the other question, the one numbers alone don't
 * settle: does it actually *look* different? Visible change is the single
 * most motivating thing an assessment-driven app can show, and the photos
 * were already being captured and stored — this is just the first screen
 * that renders them.
 */

import { useEffect, useState } from 'react';
import { getPostureLogs, getPosturePhoto } from '../storage/repository';
import type { PostureLog, PostureView } from '../engine/types';

export interface PostureCompareProps {
  onBack: () => void;
}

function dateLabel(log: PostureLog): string {
  return new Date(log.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PostureCompare({ onBack }: PostureCompareProps) {
  const [logs, setLogs] = useState<PostureLog[] | undefined>();
  const [beforeId, setBeforeId] = useState<string>();
  const [afterId, setAfterId] = useState<string>();
  const [view, setView] = useState<PostureView>('front');
  const [sliderPct, setSliderPct] = useState(50);
  const [beforeUrl, setBeforeUrl] = useState<string>();
  const [afterUrl, setAfterUrl] = useState<string>();

  useEffect(() => {
    void getPostureLogs().then((l) => {
      setLogs(l);
      setBeforeId(l[0]?.id);
      setAfterId(l[l.length - 1]?.id);
    });
  }, []);

  const beforeLog = logs?.find((l) => l.id === beforeId);
  const afterLog = logs?.find((l) => l.id === afterId);

  // Only offer a view (front/side) both selected scans actually captured —
  // switching to one that's missing for either side would just show a gap.
  const availableViews: PostureView[] = (['front', 'side'] as const).filter(
    (v) => beforeLog?.views.includes(v) && afterLog?.views.includes(v),
  );

  useEffect(() => {
    if (availableViews.length > 0 && !availableViews.includes(view)) {
      setView(availableViews[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeId, afterId]);

  useEffect(() => {
    if (!beforeId || !afterId) return;
    let cancelled = false;
    let bUrl: string | undefined;
    let aUrl: string | undefined;

    void Promise.all([getPosturePhoto(beforeId, view), getPosturePhoto(afterId, view)]).then(
      ([bBlob, aBlob]) => {
        if (cancelled) return;
        bUrl = bBlob ? URL.createObjectURL(bBlob) : undefined;
        aUrl = aBlob ? URL.createObjectURL(aBlob) : undefined;
        setBeforeUrl(bUrl);
        setAfterUrl(aUrl);
      },
    );

    return () => {
      cancelled = true;
      if (bUrl) URL.revokeObjectURL(bUrl);
      if (aUrl) URL.revokeObjectURL(aUrl);
    };
  }, [beforeId, afterId, view]);

  if (!logs) {
    return <div className="today today--loading">Loading…</div>;
  }

  return (
    <div className="phase-screen posture-compare">
      <div className="phase-screen__eyebrow">Compare</div>

      <div className="posture-compare__pickers">
        <select
          className="posture-compare__select"
          value={beforeId}
          onChange={(e) => setBeforeId(e.target.value)}
          aria-label="Before scan"
        >
          {logs.map((l) => (
            <option key={l.id} value={l.id}>
              {dateLabel(l)}
            </option>
          ))}
        </select>
        <span className="posture-compare__vs">vs</span>
        <select
          className="posture-compare__select"
          value={afterId}
          onChange={(e) => setAfterId(e.target.value)}
          aria-label="After scan"
        >
          {logs.map((l) => (
            <option key={l.id} value={l.id}>
              {dateLabel(l)}
            </option>
          ))}
        </select>
      </div>

      {availableViews.length > 1 && (
        <div className="posture-compare__view-toggle">
          {availableViews.map((v) => (
            <button
              key={v}
              className={`chip${v === view ? ' chip--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'front' ? 'Front' : 'Side'}
            </button>
          ))}
        </div>
      )}

      {!beforeUrl || !afterUrl ? (
        <p className="placeholder__body">
          No {view} photo for one or both of these scans — pick a different pair or view above.
        </p>
      ) : (
        <>
          <div className="posture-compare__slider">
            {/* Before is the always-visible base layer; after is clipped to
                its right-hand portion, so left of the handle always reads as
                "before" and right always reads as "after" — matching the
                labels below regardless of which way the handle is dragged. */}
            <img src={beforeUrl} alt={`${dateLabel(beforeLog!)} scan`} className="posture-compare__img" />
            <div
              className="posture-compare__img posture-compare__img--after"
              style={{ clipPath: `inset(0 0 0 ${sliderPct}%)` }}
            >
              <img src={afterUrl} alt={`${dateLabel(afterLog!)} scan`} className="posture-compare__img" />
            </div>
            <div className="posture-compare__handle" style={{ left: `${sliderPct}%` }} />
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPct}
              onChange={(e) => setSliderPct(Number(e.target.value))}
              className="posture-compare__range"
              aria-label="Drag to compare the before and after photos"
            />
          </div>
          <div className="posture-compare__labels">
            <span>{beforeLog && dateLabel(beforeLog)}</span>
            <span>{afterLog && dateLabel(afterLog)}</span>
          </div>
        </>
      )}

      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
