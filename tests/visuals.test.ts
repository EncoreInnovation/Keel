import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/exercises';
import { muscleEmphasis } from '../src/ui/MuscleDiagram';
import { embedUrl, youtubeId } from '../src/ui/video';

describe('muscle emphasis', () => {
  it('marks primary over secondary, and everything else unworked', () => {
    const squat = CATALOG.find((e) => e.id === 'barbell-back-squat')!;
    expect(muscleEmphasis(squat, 'quads')).toBe('primary');
    expect(muscleEmphasis(squat, 'adductors')).toBe('secondary');
    expect(muscleEmphasis(squat, 'biceps')).toBe('none');
  });
});

describe('video embed', () => {
  it('turns every catalog video into a privacy-enhanced embed', () => {
    for (const e of CATALOG) {
      const url = embedUrl(e.videoUrl!);
      expect(url, e.id).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?rel=0/);
    }
  });

  it('extracts ids even with extra query params, and rejects non-video links', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=SY5lRzBPtM4&t=10')).toBe('SY5lRzBPtM4');
    expect(embedUrl('https://example.com/video')).toBeUndefined();
  });
});
