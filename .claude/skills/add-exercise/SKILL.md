---
name: add-exercise
description: Add exercises to the COLOSSUS catalog correctly, with the right muscle roles, ladder edges, equipment tags, and goal/corrective ratings. Use whenever adding, editing, or auditing entries in catalog/exercises.ts, or when expanding a progression ladder.
---

# Adding an exercise to the COLOSSUS catalog

The catalog is the input to every scoring decision the engine makes. A
mistagged exercise doesn't fail loudly — it quietly skews selection, fatigue,
and recovery for weeks. This skill exists so that never happens.

## Where things live

- `catalog/exercises.ts` — the single catalog. There is no `base.json` /
  `overlay.json`; the header comment mentioning a build script is stale.
- `src/engine/types.ts` — the `Exercise` interface (the schema you must fill).
- `src/engine/ladders.ts` — how `progressionOf` becomes a bidirectional graph.

## The shape

Entries are written through the local `ex()` helper. Required fields:

| Field | Rule |
|---|---|
| `id` | kebab-case, stable forever — it is the key in every logged set |
| `name` | What a lifter calls it, not a textbook name |
| `primaryMuscles` | Movers actually limiting the set. Usually 1–2. Never pad this. |
| `secondaryMuscles` | Real contributors at roughly half the stimulus |
| `patterns` | From `MOVEMENT_PATTERNS` — drives slot matching |
| `equipment` | EVERY item required. The selector rejects the exercise unless the active gym has all of them. |
| `loadType` | `external` only if weight is the progression axis. Bodyweight and band work is `bodyweight` / `band` and progresses by ladder. |
| `impact` | Ground reaction. Anything with a flight phase is at least `moderate`. |
| `level` | Gate, not a suggestion |
| `unilateral` | `true` means it is logged per side and feeds asymmetry tracking |
| `goalFit` | 0–1 toward the wrestler build: thick upper back, traps, delts, posterior chain |
| `correctiveFit` | 0–1 for repositioning, anti-rotation, offset loading, scapular control |
| `jointLoad` | Joints meaningfully loaded — cross-referenced against pain flags |
| `instructions` | 3–4 imperative steps. These ARE rendered to the user. |
| `breathCue` | One short line, shown during the set |

## Rules that are easy to get wrong

**`primaryMuscles` means limiting, not involved.** A goblet squat is quads and
glutes. It is not also abs, biceps, and forearms because they're switched on.
Over-tagging inflates fatigue and suppresses the exercise for days afterward.

**`equipment` is an AND, not an OR.** Listing `['dumbbell', 'bench']` means the
exercise is invisible in any gym lacking a bench. If it can be done on the
floor, don't list the bench.

**`loadType: 'external'` requires that the weight be adjustable in that gym.**
Check `achievableLoads` in `src/engine/loading.ts`: fixed dumbbells at
10/20/30 make load a coarse axis, so movements that need fine progression
belong on a ladder or on the barbell/EZ bar where plates exist.

**`progressionOf` points DOWN, at the easier rung.** Only the downward edge is
authored; upward edges are derived by inverting it, so the two can never
disagree. Never author both directions.

## Ladder rules

- One chain per movement pattern, strictly easiest → hardest.
- Every rung must be a real, trainable variation, not a token step.
- A chain must not stop short of the obvious goal. The push-up chain ends at a
  one-arm push-up, not at a standard push-up; the pull-up chain must contain an
  actual pull-up. (Both were truncated in v1 — check before assuming.)
- Verify with `ladderChain()` in `src/engine/baseline.ts` after editing.

## After editing

1. `npx tsc -b --noEmit`
2. `npx vitest run` — the simulation asserts every prescribed weight is
   physically loadable and that ladders advance; a bad entry usually trips it.
3. If the exercise is in Block 1, confirm it renders in the session player with
   its instructions.
