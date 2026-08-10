/**
 * Screen Wake Lock, held for the duration of a session.
 *
 * Nothing kills flow like the screen sleeping mid-set. The lock is
 * automatically released by the browser when the tab backgrounds and must be
 * re-acquired on visibility change — handled here so callers just hold the
 * returned handle for as long as the session is active.
 */

export interface WakeLockHandle {
  release: () => Promise<void>;
}

// Defined locally rather than relying on lib.dom.d.ts including the Screen
// Wake Lock API — coverage varies across TypeScript versions, and this app
// only ever needs the one method it calls.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export async function acquireWakeLock(): Promise<WakeLockHandle | undefined> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
  };
  if (!nav.wakeLock) return undefined;

  let sentinel: WakeLockSentinelLike | undefined;
  try {
    sentinel = await nav.wakeLock.request('screen');
  } catch {
    return undefined;
  }

  const reacquire = async () => {
    if (document.visibilityState === 'visible' && !sentinel) {
      try {
        sentinel = await nav.wakeLock?.request('screen');
      } catch {
        // Best-effort — a failed reacquire just means the screen can sleep.
      }
    }
  };

  document.addEventListener('visibilitychange', reacquire);

  return {
    release: async () => {
      document.removeEventListener('visibilitychange', reacquire);
      await sentinel?.release();
      sentinel = undefined;
    },
  };
}
