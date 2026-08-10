/**
 * Rest-timer and set-completion cues, synthesized with the Web Audio API.
 *
 * No audio files: a beep is a sine wave, and generating it in-line means
 * there is nothing to fetch, nothing to cache, and nothing that can go
 * missing offline. One shared AudioContext, created lazily on first user
 * gesture (autoplay policies block it otherwise) and reused for every cue.
 */

let ctx: AudioContext | undefined;

function getContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(frequency: number, startAt: number, durationSec: number, gainPeak = 0.15): void {
  const audio = getContext();
  if (!audio) return;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  const t0 = audio.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

/** Call once on the first user tap of a session so autoplay policies don't swallow later cues. */
export function primeAudio(): void {
  getContext();
}

export function playSetComplete(): void {
  tone(660, 0, 0.12);
}

export function playRestStart(): void {
  tone(440, 0, 0.15);
}

/** The three quiet ticks in the last three seconds of rest. */
export function playRestCountdownTick(): void {
  tone(520, 0, 0.08, 0.09);
}

export function playRestEnd(): void {
  tone(392, 0, 0.14);
  tone(587, 0.1, 0.18);
}
