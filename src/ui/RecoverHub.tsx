/**
 * Recover — "how do I feel better and get ready?" Recovery status first,
 * then what to do right now and why, then every session grouped by when
 * you'd reach for it, each saying what it does and when to use it.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../../catalog/exercises';
import { PILLAR_GROUPS, PILLAR_SESSIONS } from '../pillars/library';
import type { Recommendation } from '../pillars/recommend';
import { loadRecommendations } from '../state/recommendations';
import type { Exercise, PillarKind, PrescribedSession } from '../engine/types';
import { RecommendationCard } from './RecommendationCard';
import { RecoveryPreview } from './RecoveryPreview';

export interface RecoverHubProps {
  prescription: PrescribedSession;
  onOpenPillar: (kind: PillarKind) => void;
  onOpenRecovery: () => void;
}

export function RecoverHub({ prescription, onOpenPillar, onOpenRecovery }: RecoverHubProps) {
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    void loadRecommendations(CATALOG as Exercise[], prescription, Date.now()).then(setRecs);
  }, [prescription]);

  return (
    <div className="phase-screen hub">
      <div className="phase-screen__eyebrow">Recover</div>
      <p className="hub__intro">Get ready, calm down, and recover. Short guided sessions — pick by what you need right now.</p>

      <RecoveryPreview onOpenRecovery={onOpenRecovery} />
      <p className="hub__caption">Green = ready to train hard. Amber = go lighter, or train something else.</p>

      {recs.map((r) => (
        <RecommendationCard key={r.kind} rec={r} onOpen={onOpenPillar} />
      ))}

      {PILLAR_GROUPS.map((group) => (
        <section key={group.title} className="hub__group">
          <h2 className="settings-section__title">{group.title}</h2>
          {group.kinds.map((kind) => {
            const s = PILLAR_SESSIONS[kind];
            return (
              <button key={kind} className="hub-card" onClick={() => onOpenPillar(kind)}>
                <div className="hub-card__head">
                  <span className="hub-card__title">{s.name}</span>
                  <span className="hub-card__meta">{s.minutes} min ›</span>
                </div>
                <div className="hub-card__body">{s.purpose}</div>
                <div className="hub-card__when">
                  <strong>When:</strong> {s.when}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
