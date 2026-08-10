/**
 * The client's whole job is to never let a coach failure become an app
 * crash. Every failure mode below must resolve to `{ ok: false }`, never
 * throw and never return `undefined` where the UI expects a result object.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { askCoach } from '../src/ai/client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('askCoach', () => {
  it('returns the text on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Push through set two.' }) }),
    );
    const result = await askCoach('How am I doing?');
    expect(result).toEqual({ ok: true, text: 'Push through set two.' });
  });

  it('resolves ok:false on a non-2xx response, exactly what a missing /api/coach in local dev returns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await askCoach('anything');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('404');
  });

  it('resolves ok:false rather than throwing when the network call itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await askCoach('anything');
    expect(result).toEqual({ ok: false, error: 'Coach unavailable — check your connection.' });
  });

  it('resolves ok:false when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('bad json'); } }),
    );
    const result = await askCoach('anything');
    expect(result.ok).toBe(false);
  });

  it('resolves ok:false when the JSON body has no text field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'oops' }) }));
    const result = await askCoach('anything');
    expect(result.ok).toBe(false);
  });

  it('sends the prompt as JSON in the POST body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'ok' }) });
    vi.stubGlobal('fetch', fetchMock);
    await askCoach('What should I focus on?');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/coach');
    expect(JSON.parse(init.body)).toEqual({ prompt: 'What should I focus on?' });
  });
});
