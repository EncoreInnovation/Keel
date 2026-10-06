/** More — the occasional tools, each with a line on when you'd use it. */

import { RPE_EXPLAINER } from './rpe';

export interface MoreHubProps {
  onOpenConditioning: () => void;
  onOpenAskCoach: () => void;
  onOpenSettings: () => void;
}

function Item({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button className="hub-card" onClick={onClick}>
      <div className="hub-card__head">
        <span className="hub-card__title">{title}</span>
        <span className="hub-card__meta">›</span>
      </div>
      <div className="hub-card__body">{body}</div>
    </button>
  );
}

export function MoreHub({ onOpenConditioning, onOpenAskCoach, onOpenSettings }: MoreHubProps) {
  return (
    <div className="phase-screen hub">
      <div className="phase-screen__eyebrow">More</div>
      <Item
        title="Log activity"
        body="Insanity, runs, walks, bike or elliptical done outside the app. Logging it lets the app ease off your legs next session."
        onClick={onOpenConditioning}
      />
      <Item
        title="Ask the coach"
        body="Questions about training, food, recovery or how you feel. AI answers — not medical advice."
        onClick={onOpenAskCoach}
      />
      <Item
        title="Settings"
        body="Each gym’s equipment and weights, flagged joints, and backup/restore of your data."
        onClick={onOpenSettings}
      />

      <section className="hub__group hub__help">
        <h2 className="settings-section__title">Help</h2>
        <p className="hub-card__body">
          <strong>Put it on your home screen:</strong> iPhone — open in Safari, tap Share, then “Add to Home Screen”.
          Android — Chrome menu (⋮), then “Add to Home screen”.
        </p>
        <p className="hub-card__body">
          <strong>Effort rating (RPE):</strong> {RPE_EXPLAINER}
        </p>
        <p className="hub-card__body">
          <strong>Updates:</strong> close and reopen the app to load the latest version.
        </p>
      </section>
    </div>
  );
}
