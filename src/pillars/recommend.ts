/**
 * "Recommended now" — the one or two breath/mobility/mind sessions worth
 * doing right now, with the reason, so nobody has to know the library to
 * use it. Pure: everything it needs is passed in.
 */

import type { PillarKind } from '../engine/types';

export interface RecommendInput {
  hour: number;
  pelvicDoneToday: boolean;
  /** Readiness picked for today's session, if any (1–5). */
  readiness?: number;
  /** Lowest recovery (0..1) across the muscles today's session trains. */
  lowestRecovery?: number;
  trainedToday: boolean;
  /** Posture headline when the latest scan shows a tilt; undefined when level or unscanned. */
  postureTilt?: string;
  realignInLastTwoDays: boolean;
  /** Whole days since Hip Flow was last done; undefined if never. */
  hipFlowDaysSince?: number;
  /** A planned rest day (known in Dig Deeper mode). */
  restDay?: boolean;
}

/** Hip Flow is a 3–4×-a-week session; nudge once it's been this long. */
export const HIP_FLOW_EVERY_DAYS = 3;

export interface Recommendation {
  kind: PillarKind;
  reason: string;
}

export const MAX_RECOMMENDATIONS = 2;

export function recommendSessions(input: RecommendInput): Recommendation[] {
  const out: Recommendation[] = [];
  const add = (kind: PillarKind, reason: string) => {
    if (out.length < MAX_RECOMMENDATIONS && !out.some((r) => r.kind === kind)) out.push({ kind, reason });
  };

  if (!input.pelvicDoneToday) add('pelvic', 'Daily — you haven’t done it yet today.');
  if ((input.readiness !== undefined && input.readiness <= 2) || (input.lowestRecovery !== undefined && input.lowestRecovery < 0.4)) {
    add('ground', 'Low energy or under-recovered — keep the habit with 5 easy minutes.');
  }
  if (input.hour < 10 && !input.trainedToday) add('activate', 'Early start — wake the body up before you train.');
  if (input.postureTilt && !input.realignInLastTwoDays) add('realign', `Your last scan: ${input.postureTilt}.`);
  const hipFlowDue = input.hipFlowDaysSince === undefined || input.hipFlowDaysSince >= HIP_FLOW_EVERY_DAYS;
  if (hipFlowDue && (input.trainedToday || input.restDay)) {
    add(
      'hipflow',
      input.hipFlowDaysSince === undefined
        ? 'Hips and lower core — a good one after training or on a rest day.'
        : `Hips and lower core — last done ${input.hipFlowDaysSince} days ago.`,
    );
  }
  if (input.hour >= 19) {
    if (input.trainedToday) add('nsdr', 'You trained today — deep rest helps recovery and sleep.');
    else add('resonance', 'Evening — slow breathing to wind down for sleep.');
  }
  add('sigh', 'Five minutes for mood and stress — the easiest daily win.');
  return out;
}
