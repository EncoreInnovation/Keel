/**
 * The one server-side function in COLOSSUS, and its only job: hold the Gemini
 * API key so it never ships in the client bundle. Everything about *what*
 * to ask — the prompt text — is built client-side in `src/ai/prompts.ts`,
 * fully testable without this file or a network call. This function is a
 * thin, dumb relay on purpose.
 */

interface CoachRequest {
  method?: string;
  body?: { prompt?: unknown };
}

interface CoachResponse {
  status: (code: number) => CoachResponse;
  json: (body: unknown) => void;
}

const MODEL = 'gemini-flash-lite-latest';

export default async function handler(req: CoachRequest, res: CoachResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({ error: 'Missing prompt.' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: `Coach upstream error: ${detail.slice(0, 300)}` });
      return;
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      res.status(502).json({ error: 'Coach returned no text.' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown coach error.' });
  }
}
