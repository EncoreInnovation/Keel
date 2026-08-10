/**
 * App shell — a plain state machine, no router. The whole app is one linear
 * path most days: Today → Arrive → Session → Downshift → back to Today. That
 * matches the zero-decision philosophy better than a navigable multi-screen
 * structure would.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../catalog/exercises';
import { Asymmetry } from './ui/Asymmetry';
import { ArrivePhase } from './ui/ArrivePhase';
import { DownshiftPhase } from './ui/DownshiftPhase';
import { PillarPlayer } from './ui/PillarPlayer';
import { SessionPlayer } from './ui/SessionPlayer';
import { Setup } from './ui/Setup';
import { Today } from './ui/Today';
import { primeAudio } from './ui/audio';
import { acquireWakeLock, type WakeLockHandle } from './ui/wakeLock';
import { PILLAR_SESSIONS } from './pillars/library';
import { completeSession, loadToday, type TodayState } from './state/sessionController';
import { getProfile, saveProfile } from './storage/repository';
import type { Exercise, PillarKind, UserProfile } from './engine/types';

const catalog = CATALOG as Exercise[];

type Screen = 'loading' | 'setup' | 'today' | 'arrive' | 'session' | 'downshift' | 'pillar' | 'asymmetry';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [today, setToday] = useState<TodayState | undefined>();
  const [pillar, setPillar] = useState<PillarKind>('reset');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      const stored = await getProfile();
      if (!stored) {
        setScreen('setup');
        return;
      }
      setProfile(stored);
      await refreshToday(stored);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshToday(p: UserProfile) {
    try {
      const state = await loadToday(catalog, p, Date.now());
      setToday(state);
      setScreen('today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading today.');
    }
  }

  async function handleSetupComplete(p: UserProfile) {
    await saveProfile(p);
    setProfile(p);
    await refreshToday(p);
  }

  function handleStart() {
    primeAudio();
    setScreen('arrive');
  }

  useEffect(() => {
    if (screen !== 'session') return;
    let handle: WakeLockHandle | undefined;
    void acquireWakeLock().then((h) => {
      handle = h;
    });
    return () => {
      void handle?.release();
    };
  }, [screen]);

  if (error) {
    return (
      <div className="today">
        <p className="placeholder__body">{error}</p>
      </div>
    );
  }

  if (screen === 'loading') {
    return <div className="today today--loading">Loading…</div>;
  }

  if (screen === 'setup') {
    return <Setup onComplete={handleSetupComplete} />;
  }

  if (!profile || !today) {
    return <div className="today today--loading">Loading…</div>;
  }

  if (screen === 'today') {
    return (
      <Today
        prescription={today.prescription}
        weeksTotal={today.block.weeks}
        resumed={today.resumed}
        onStart={handleStart}
        onOpenPillar={(kind) => {
          setPillar(kind);
          setScreen('pillar');
        }}
        onOpenAsymmetry={() => setScreen('asymmetry')}
      />
    );
  }

  if (screen === 'pillar') {
    return <PillarPlayer session={PILLAR_SESSIONS[pillar]} onComplete={() => setScreen('today')} />;
  }

  if (screen === 'asymmetry') {
    return <Asymmetry onBack={() => setScreen('today')} />;
  }

  if (screen === 'arrive') {
    return <ArrivePhase dayId={today.prescription.dayId} onComplete={() => setScreen('session')} />;
  }

  if (screen === 'session') {
    return (
      <SessionPlayer
        sessionId={today.sessionId}
        block={today.block}
        profile={profile}
        initialPrescription={today.prescription}
        onSessionComplete={() => setScreen('downshift')}
      />
    );
  }

  if (screen === 'downshift') {
    return (
      <DownshiftPhase
        dayId={today.prescription.dayId}
        onComplete={async () => {
          await completeSession(Date.now());
          await refreshToday(profile);
        }}
      />
    );
  }

  return null;
}
