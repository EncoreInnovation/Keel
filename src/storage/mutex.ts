/**
 * Per-key write serialization.
 *
 * `idb-keyval`'s array-valued keys (the set log, the conditioning log) are
 * read-modify-write: read the array, push, write it back. Two writes racing
 * — a rest-timer autosave firing the same instant as a DONE tap — can lose
 * one if they interleave. This is not a theoretical concern for a set logger:
 * it is the one bug that would make the app lie about what you actually did.
 *
 * `runExclusive` chains callers behind the same key onto one promise, so each
 * read-modify-write completes before the next one starts. It never blocks
 * writes to a different key.
 */

const queues = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Swallow rejections in the chain itself so one failed write doesn't wedge
  // the queue for everyone after it; the caller's own promise still rejects.
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}
