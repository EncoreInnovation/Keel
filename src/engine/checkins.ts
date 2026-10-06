/**
 * When to ask for body check-ins. Weekly weight + waist (the waist is the
 * better fat-loss signal — the scale moves with water and running), and
 * monthly physique photos (change is too slow to see week to week).
 */

import type { BodyMetricLog, PhysiqueLog } from './types';

const DAY_MS = 86_400_000;
export const WEIGH_IN_EVERY_DAYS = 7;
export const PHOTOS_EVERY_DAYS = 28;

export function weighInDue(metrics: BodyMetricLog[], now: number): boolean {
  const last = [...metrics].reverse().find((m) => m.weight !== undefined || m.measurements?.waist !== undefined);
  return !last || now - last.at >= WEIGH_IN_EVERY_DAYS * DAY_MS;
}

export function physiqueDue(logs: PhysiqueLog[], now: number): boolean {
  const last = logs.at(-1);
  return !last || now - last.at >= PHOTOS_EVERY_DAYS * DAY_MS;
}
