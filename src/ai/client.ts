/**
 * Client-side call to the coach relay. Every failure mode — no deployment,
 * offline, upstream hiccup — resolves to `{ ok: false }` rather than
 * throwing, because the app has to stay fully usable with the AI layer
 * completely unreachable. In local dev, `/api/coach` doesn't exist at all
 * (Vite doesn't run Vercel functions), so this path is exercised constantly
 * during development, not just in some rare production edge case.
 */

export type CoachResult = { ok: true; text: string } | { ok: false; error: string };

export async function askCoach(prompt: string): Promise<CoachResult> {
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      return { ok: false, error: `Coach unavailable (${res.status}).` };
    }

    const data = await res.json().catch(() => undefined);
    if (!data || typeof data.text !== 'string') {
      return { ok: false, error: 'Coach returned an unexpected response.' };
    }

    return { ok: true, text: data.text };
  } catch {
    return { ok: false, error: 'Coach unavailable — check your connection.' };
  }
}
