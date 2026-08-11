---
name: verify-in-browser
description: Drive the COLOSSUS app in a real headless browser to verify a change actually works before calling it done. Use after any UI change, engine change that reaches the UI, or before committing a feature. Typechecking and unit tests are not sufficient evidence.
---

# Verifying COLOSSUS in a real browser

Every significant defect found in this project so far was found here, not by
the type checker and not by unit tests. A green suite means the code does what
the tests describe; it says nothing about whether the screen is usable.

Bugs this caught that tests missed: the weight stepper hidden on a first-ever
exercise, pillar chips clipping at 390 px, MediaPipe angle math wrapping to
±180°, service-worker timing making offline checks flaky, and a baseline test
that placed a man who can do 12 push-ups on wall push-ups.

## Setup

Chromium is preinstalled. Do not run `playwright install`.

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
```

Scripts live in `/tmp/keel-smoke-dir/` with `node_modules` symlinked to the
global playwright install. Run the dev server first:

```
npm run dev > /tmp/keel-dev.log 2>&1 &
```

## Always capture console errors

```js
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
```

`/api/coach` returns 404 in local dev — there are no serverless routes under
`vite dev`. That specific 404 is expected; filter it, don't chase it.

## Getting past the front door

The app is a linear state machine with no router, so reach a screen by driving
the flow, not by navigating to a URL:

1. Setup — fill bodyweight, pick a gym, press Start
2. Baseline — fill or press "Skip for now"
3. Readiness — `.activation-rating__opt`
4. Today

To start from a clean slate, delete IndexedDB and reload:

```js
await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  await Promise.all(dbs.map((d) => new Promise((res) => {
    const r = indexedDB.deleteDatabase(d.name);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  })));
});
await page.reload({ waitUntil: 'domcontentloaded' });
```

## Inspecting real stored state

Import the repository directly in the page to assert on what was actually
persisted, rather than trusting the UI:

```js
const state = await page.evaluate(async () => {
  const { getAllSets, getProfile } = await import('/src/storage/repository.ts');
  return { sets: await getAllSets(), profile: await getProfile() };
});
```

## Traps

- **`has-text` matches substrings, case-insensitively.** `button:has-text("Back")`
  also matches a "Low back" chip. Scope it: `.btn--ghost:has-text("Back")`.
- **The Arrive phase is genuinely ~2 minutes** (breath cycles plus a primer).
  Wait on `.steppers` with a long timeout rather than a fixed sleep.
- **Offline checks need `navigator.serviceWorker.controller` to be non-null**
  before `setOffline(true)`. Cache population alone is not enough and makes the
  test flaky.
- Take screenshots at each step and actually look at them — layout problems are
  invisible to assertions.

## The bar

A feature is done when it has been driven in the browser, the console is clean,
the screenshots look right, and persisted state has been checked. Report what
was verified, and say plainly if something was not.
