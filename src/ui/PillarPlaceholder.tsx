/**
 * Standalone Reset/Ground micro-sessions are Milestone 2 (see the plan's
 * pillar library work). Rather than a dead tap, this says so plainly — an
 * honest placeholder beats a chip that quietly does nothing.
 */

export interface PillarPlaceholderProps {
  kind: 'reset' | 'ground';
  onBack: () => void;
}

const COPY: Record<PillarPlaceholderProps['kind'], { title: string; body: string }> = {
  reset: {
    title: 'Reset',
    body: 'A 5–12 minute nervous-system-down session — physiological sigh, box breathing, coherent breathing. Arriving in Milestone 2.',
  },
  ground: {
    title: 'Ground',
    body: 'The 5-minute floor-based session for a no-capacity day. Arriving in Milestone 2.',
  },
};

export function PillarPlaceholder({ kind, onBack }: PillarPlaceholderProps) {
  const copy = COPY[kind];
  return (
    <div className="phase-screen">
      <div className="phase-screen__eyebrow">{copy.title}</div>
      <p className="placeholder__body">{copy.body}</p>
      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
