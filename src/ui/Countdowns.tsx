/**
 * The days left to the dates that matter, as a row of tiles. Shown on Today
 * so the budget is in view every morning, and on the Q4 plan.
 */

import { countdowns, type Countdown } from '../engine/countdowns';

const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export interface CountdownsProps {
  now: number;
  birthday?: { month: number; day: number };
  /** Pounds left to the weight goal — shown under the Q4 tile. */
  poundsToGo?: number;
  onSelect?: () => void;
}

export function Countdowns({ now, birthday, poundsToGo, onSelect }: CountdownsProps) {
  const sub = (c: Countdown) => {
    if (c.id === 'q4' && poundsToGo !== undefined) {
      return poundsToGo > 0 ? `${Math.round(poundsToGo * 10) / 10} lb to go` : 'Weight goal hit';
    }
    return dateLabel(c.date);
  };

  return (
    <div className="countdowns" role="list" aria-label="Countdowns">
      {countdowns(now, birthday).map((c) => {
        const content = (
          <>
            <span className="countdowns__label">{c.label}</span>
            <span className="countdowns__days" data-numeric>
              {c.days === 0 ? 'Today' : c.days}
            </span>
            <span className="countdowns__unit">{c.days === 0 ? '' : c.days === 1 ? 'day' : 'days'}</span>
            <span className="countdowns__sub">{sub(c)}</span>
          </>
        );
        return onSelect ? (
          <button key={c.id} role="listitem" className={`countdowns__tile countdowns__tile--${c.id}`} onClick={onSelect}>
            {content}
          </button>
        ) : (
          <div key={c.id} role="listitem" className={`countdowns__tile countdowns__tile--${c.id}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
