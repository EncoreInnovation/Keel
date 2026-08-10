/**
 * App shell — a plain state machine, no router. The whole app is one linear
 * path most days: Today → Arrive → Session → Downshift → back to Today. That
 * matches the zero-decision philosophy better than a navigable multi-screen
 * structure would.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../catalog/exercises';
import { ActivationRating, READINESS_LABELS } from './ui/ActivationRating';
import { Asymmetry } from './ui/Asymmetry';
import { ArrivePhase } from './ui/ArrivePhase';
import { ConditioningLogForm } from './ui/ConditioningLogForm';
import { DownshiftPhase } from './ui/DownshiftPhase';
import { PillarPlayer } from './ui/PillarPlayer';
import { PostureHistory } from './ui/PostureHistory';
import { PostureScan } from './ui/PostureScan';
import { Progress } from './ui/Progress';
import { RecoveryMap } from './ui/RecoveryMap';
import { SessionPlayer } from './ui/SessionPlayer';
import { Settings } from './ui/Settings';
import { Setup } from './ui/Setup';
import { Today } from './ui/Today';
import { primeAudio } from './ui/audio';
import { acquireWakeLock, type WakeLockHandle } from './ui/wakeLock';
import { PILLAR_SESSIONS } from './pillars/library';
import {
  completeSession,
  hasStartedTodaySession,
  loadToday,
  type TodayState,
} from './state/sessionController';
import { getProfile, saveProfile } from './storage/repository';
import type { Exercise, PillarKind, UserProfile } from './engine/types';

const catalog = CATALOG as Exercise[];

type Screen =
  | 'loading'
  | 'setup'
  | 'readiness'
  | 'today'
  | 'arrive'
  | 'session'
  | 'downshift'
  | 'pillar'
  | 'asymmetry'
  | 'recovery'
  | 'progress'
  | 'postureHistory'
  | 'postureScan'
  | 'conditioning'
  | 'settings';

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
      await goToTodayOrReadiness(stored);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshToday(p: UserProfile, readiness?: number) {
    try {
      const state = await loadToday(catalog, p, Date.now(), readiness);
      setToday(state);
      setScreen('today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading today.');
    }
  }

  /**
   * A resumed session already had its readiness collected when it was first
   * generated — no need to ask again. A brand-new one hasn't, so the
   * readiness gate goes first: `volumeMultiplier` only sees readiness if
   * it's known *before* the prescription is built, not after.
   */
  async function goToTodayOrReadiness(p: UserProfile) {
    const started = await hasStartedTodaySession();
    if (started) {
      await refreshToday(p);
    } else {
      setScreen('readiness');
    }
  }

  async function handleSetupComplete(p: UserProfile) {
    await saveProfile(p);
    setProfile(p);
    await goToTodayOrReadiness(p);
  }

  async function handleReadinessSelected(value: number) {
    if (!profile) return;
    await refreshToday(profile, value);
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

  if (screen === 'readiness') {
    return (
      <ActivationRating
        prompt="How ready do you feel to train?"
        labels={READINESS_LABELS}
        onSelect={(v) => void handleReadinessSelected(v)}
      />
    );
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
        onOpenRecovery={() => setScreen('recovery')}
        onOpenProgress={() => setScreen('progress')}
        onOpenPosture={() => setScreen('postureHistory')}
        onOpenConditioning={() => setScreen('conditioning')}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  }

  if (screen === 'pillar') {
    return <PillarPlayer session={PILLAR_SESSIONS[pillar]} onComplete={() => setScreen('today')} />;
  }

  if (screen === 'asymmetry') {
    return <Asymmetry onBack={() => setScreen('today')} />;
  }

  if (screen === 'recovery') {
    return <RecoveryMap onBack={() => setScreen('today')} />;
  }

  if (screen === 'progress') {
    return <Progress onBack={() => setScreen('today')} onOpenAsymmetry={() => setScreen('asymmetry')} />;
  }

  if (screen === 'postureHistory') {
    return (
      <PostureHistory onBack={() => setScreen('today')} onNewScan={() => setScreen('postureScan')} />
    );
  }

  if (screen === 'postureScan') {
    return (
      <PostureScan
        onDone={() => setScreen('postureHistory')}
        onCancel={() => setScreen('postureHistory')}
      />
    );
  }

  if (screen === 'conditioning') {
    return (
      <ConditioningLogForm onSaved={() => setScreen('today')} onCancel={() => setScreen('today')} />
    );
  }

  if (screen === 'settings') {
    return (
      <Settings
        profile={profile}
        onSaved={(updated) => setProfile(updated)}
        onBack={() => setScreen('today')}
      />
    );
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
          await goToTodayOrReadiness(profile);
        }}
      />
    );
  }

  return null;
}
