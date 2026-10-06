import { describe, expect, it } from 'vitest';
import { CUE_WORDS, FINISHER_FRAME, restPrompt } from '../src/mind/cues';

describe('mental-skills cues', () => {
  it('turns rest before a primary lift into a rehearsal', () => {
    expect(restPrompt('primary', 'Brace')).toMatch(/Rehearse/);
    expect(restPrompt('primary', 'Brace')).toContain('Brace');
  });

  it('frames the last block of work differently from an ordinary rest', () => {
    expect(restPrompt('finisher')).not.toBe(restPrompt('secondary'));
    expect(FINISHER_FRAME).toMatch(/Discomfort/);
  });

  it('works with no cue word chosen', () => {
    expect(restPrompt('accessory')).not.toContain('Cue');
    expect(restPrompt(undefined)).toBeTruthy();
  });

  it('offers a short list of one- or two-word cues', () => {
    for (const cue of CUE_WORDS) expect(cue.split(' ').length).toBeLessThanOrEqual(2);
  });
});

import { COACHING_TIPS, tipForDay } from '../src/mind/guidance';

describe('coaching guidance', () => {
  it('cites a source for every tip and rotates daily', () => {
    for (const tip of COACHING_TIPS) expect(tip.source.length).toBeGreaterThan(5);
    const DAY = 86_400_000;
    expect(tipForDay(0).id).not.toBe(tipForDay(DAY).id);
    expect(tipForDay(0).id).toBe(tipForDay(COACHING_TIPS.length * DAY).id);
  });
});
