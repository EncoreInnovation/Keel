/**
 * Ask the coach — free-text Q&A with a summary of recent sessions as
 * context. The only AI touchpoint the user drives directly; the other two
 * (readiness commentary, weekly reflection) happen at natural points in
 * the flow instead of behind a chat box.
 */

import { useState } from 'react';
import { askCoach } from '../ai/client';
import { buildAskCoachPrompt, summarizeRecentSessions } from '../ai/prompts';
import { getCompletedSessions } from '../storage/repository';

export interface AskCoachProps {
  onBack: () => void;
}

export function AskCoach({ onBack }: AskCoachProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(undefined);
    setAnswer(undefined);

    const sessions = await getCompletedSessions();
    const context = summarizeRecentSessions(sessions);
    const result = await askCoach(buildAskCoachPrompt(trimmed, context));

    setBusy(false);
    if (result.ok) setAnswer(result.text);
    else setError(result.error);
  };

  return (
    <div className="phase-screen ask-coach">
      <div className="phase-screen__eyebrow">Ask the coach</div>

      <textarea
        className="ask-coach__input"
        placeholder="What's on your mind?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
      />

      <button className="btn btn--hero" disabled={busy || !question.trim()} onClick={() => void handleAsk()}>
        {busy ? 'Asking…' : 'Ask'}
      </button>

      {answer && <div className="coach-note ask-coach__answer">{answer}</div>}
      {error && <div className="posture-scan__error">{error}</div>}

      <button className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
