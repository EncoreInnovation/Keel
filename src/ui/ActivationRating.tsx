/**
 * A 1-5 self-rated scale — one tap, no slider to fuss with. Used for pillar
 * activation ratings (before/after) and for the daily readiness check-in;
 * both are "how are you feeling," just with different labels and different
 * downstream consumers.
 */

export interface ActivationRatingProps {
  prompt: string;
  onSelect: (value: number) => void;
  labels?: [string, string, string, string, string];
}

const ACTIVATION_LABELS: [string, string, string, string, string] = [
  'Calm',
  'Settled',
  'Neutral',
  'Wound up',
  'Wired',
];

export const READINESS_LABELS: [string, string, string, string, string] = [
  'Wiped out',
  'Low',
  'Okay',
  'Good',
  'Fully charged',
];

export function ActivationRating({ prompt, onSelect, labels = ACTIVATION_LABELS }: ActivationRatingProps) {
  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">{prompt}</div>
      <div className="activation-rating">
        {labels.map((label, i) => (
          <button key={label} className="activation-rating__opt" onClick={() => onSelect(i + 1)}>
            <span className="activation-rating__num" data-numeric>
              {i + 1}
            </span>
            <span className="activation-rating__label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
