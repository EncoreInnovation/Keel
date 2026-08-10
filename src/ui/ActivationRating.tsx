/**
 * 1-5 self-rated activation, captured before and after every pillar session
 * so the delta can be charted over time (Progress screen, Milestone 3). A
 * single tap, no scale to read — five buttons, low effort by design.
 */

export interface ActivationRatingProps {
  prompt: string;
  onSelect: (value: number) => void;
}

const LABELS = ['Calm', 'Settled', 'Neutral', 'Wound up', 'Wired'];

export function ActivationRating({ prompt, onSelect }: ActivationRatingProps) {
  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">{prompt}</div>
      <div className="activation-rating">
        {LABELS.map((label, i) => (
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
