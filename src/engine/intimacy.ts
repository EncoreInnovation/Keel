/**
 * A private monthly check-in on erections and control — the only way to know
 * whether the pelvic floor, Control, cardio and fat loss are doing what
 * they're meant to.
 *
 * Modelled on the domains of the scales clinicians use (the IIEF-5 for
 * erectile function, the PEDT for ejaculatory control) but written in plain
 * words of its own, because the official questionnaires are licensed. That
 * means its numbers are for watching your own trend, not for comparing
 * against clinical cut-offs.
 *
 * Stored on the device only, in its own key; included in your own backup
 * file, never sent to the coach or anywhere else.
 */

export const INTIMACY_EVERY_DAYS = 28;

export type ScaleKind = 'level' | 'frequency' | 'control';

export interface IntimacyQuestion {
  id: 'confidence' | 'firm' | 'lasting' | 'satisfaction' | 'control';
  text: string;
  scale: ScaleKind;
  /** Questions that only apply if you had sex in the window can be skipped. */
  skippable: boolean;
}

export const SCALE_LABELS: Record<ScaleKind, [string, string, string, string, string]> = {
  level: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
  frequency: ['Almost never', 'Rarely', 'About half the time', 'Usually', 'Almost always'],
  control: ['None', 'A little', 'Some', 'A lot', 'Full control'],
};

export const INTIMACY_QUESTIONS: IntimacyQuestion[] = [
  { id: 'confidence', text: 'Over the last 4 weeks, how confident were you that you could get and keep an erection?', scale: 'level', skippable: false },
  { id: 'firm', text: 'When aroused, how often were your erections firm enough for sex?', scale: 'frequency', skippable: true },
  { id: 'lasting', text: 'During sex, how often did you stay firm until the end?', scale: 'frequency', skippable: true },
  { id: 'satisfaction', text: 'How satisfying has sex been?', scale: 'level', skippable: true },
  { id: 'control', text: 'How much control did you have over when you finished?', scale: 'control', skippable: true },
];

export interface IntimacyLog {
  id: string;
  at: number;
  /** One per question, 1–5; null when skipped (no sex in the window). */
  answers: (number | null)[];
}

/** Erections, 4–20, from the first four questions — undefined unless all four were answered. */
export function erectionScore(log: IntimacyLog): number | undefined {
  const first = log.answers.slice(0, 4);
  if (first.length < 4 || first.some((a) => a === null || a === undefined)) return undefined;
  return (first as number[]).reduce((sum, a) => sum + a, 0);
}

/** Control over finishing, 1–5. */
export function controlScore(log: IntimacyLog): number | undefined {
  return log.answers[4] ?? undefined;
}

export function intimacyDue(logs: IntimacyLog[], now: number): boolean {
  const last = [...logs].sort((a, b) => a.at - b.at).at(-1);
  return !last || now - last.at >= INTIMACY_EVERY_DAYS * 86_400_000;
}
