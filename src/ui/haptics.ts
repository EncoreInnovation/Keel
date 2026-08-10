/** Thin, support-guarded wrapper over the Vibration API — never throws on unsupported browsers. */

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
}

export const haptics = {
  setComplete: () => vibrate(30),
  restStart: () => vibrate([20, 60, 20]),
  restTick: () => vibrate(15),
  restEnd: () => vibrate([40, 80, 40, 80, 40]),
};
