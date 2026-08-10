/**
 * Vitest runs in Node, which has no IndexedDB. `fake-indexeddb/auto` installs
 * a spec-compliant in-memory implementation onto the global scope before any
 * test file loads, so `src/storage` runs against the real `idb-keyval` code
 * path rather than a hand-rolled mock — the storage tests are exercising the
 * actual persistence logic, not a stand-in for it.
 */
import 'fake-indexeddb/auto';
