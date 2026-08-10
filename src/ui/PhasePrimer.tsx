/**
 * Shared building blocks for the Arrive and Downshift phases: a
 * breath sequence that runs for a fixed number of cycles, then a short timed
 * prompt with day-specific cues. Neither carries a skip button — the plan
 * calls these "non-skippable but short," and at well under two minutes each,
 * that's a real design choice, not friction: the corrective work only earns
 * its keep if it actually happens.
 */

import { useEffect, useRef, useState } from 'react';
import { BreathPacer, type BreathProtocol } from './BreathPacer';

export interface BreathSequenceProps {
  protocol: BreathProtocol;
  cycles: number;
  onComplete: () => void;
}

export function BreathSequence({ protocol, cycles, onComplete }: BreathSequenceProps) {
  const [done, setDone] = useState(0);
  const completedRef = useRef(false);

  const handleCycle = () => {
    setDone((d) => {
      const next = d + 1;
      // The cycle that *starts* the final inhale still needs to play out —
      // completion fires after it, not the instant the count is hit.
      if (next > cycles && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return next;
    });
  };

  return (
    <div className="phase-primer">
      <BreathPacer protocol={protocol} onCycle={handleCycle} />
      <div className="phase-primer__count" data-numeric>
        {Math.min(done, cycles)} / {cycles}
      </div>
    </div>
  );
}

export interface TimedPromptProps {
  seconds: number;
  title: string;
  lines: string[];
  onComplete: () => void;
}

export function TimedPrompt({ seconds, title, lines, onComplete }: TimedPromptProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, onComplete]);

  return (
    <div className="phase-primer">
      <div className="phase-primer__clock" data-numeric>
        {remaining}
      </div>
      <div className="phase-primer__title">{title}</div>
      <ul className="phase-primer__lines">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
