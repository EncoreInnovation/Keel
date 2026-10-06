import { PILLAR_SESSIONS } from '../pillars/library';
import type { Recommendation } from '../pillars/recommend';
import type { PillarKind } from '../engine/types';

export function RecommendationCard({ rec, onOpen }: { rec: Recommendation; onOpen: (kind: PillarKind) => void }) {
  const session = PILLAR_SESSIONS[rec.kind];
  return (
    <button className="checkin-card checkin-card--button rec-card" onClick={() => onOpen(rec.kind)}>
      <div className="rec-card__eyebrow">Recommended now</div>
      <div className="checkin-card__title">
        {session.name} · {session.minutes} min ›
      </div>
      <div className="placeholder__body">{rec.reason}</div>
    </button>
  );
}
