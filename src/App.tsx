/**
 * App shell — a plain state machine, no router. The whole app is one linear
 * path most days: Today → Arrive → Session → Downshift → back to Today. That
 * matches the zero-decision philosophy better than a navigable multi-screen
 * structure would.
 */

import { useEffect, useState } from 'react';
import { CATALOG } from '../catalog/exercises';
import { AskCoach } from './ui/AskCoach';
import { BaselineTest } from './ui/BaselineTest';
import { ActivationRating, READINESS_LABELS } from './ui/ActivationRating';
import { Asymmetry } from './ui/Asymmetry';
import { ArrivePhase } from './ui/ArrivePhase';
import { ConditioningLogForm } from './ui/ConditioningLogForm';
import { DownshiftPhase } from './ui/DownshiftPhase';
import { PillarPlayer } from './ui/PillarPlayer';
import { PostureCompare } from './ui/PostureCompare';
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
import { askCoach } from './ai/client';
import { buildReadinessPrompt } from './ai/prompts';
import { PILLAR_SESSIONS } from './pillars/library';
import {
  completeSession,
  discardUntouchedSession,
  hasStartedTodaySession,
  loadToday,
  swapCandidates,
  swapExercise,
  type TodayState,
} from './state/sessionController';
import { getProfile, saveProfile } from './storage/repository';
import type { Exercise, GymId, PillarKind, UserProfile } from './engine/types';

const catalog = CATALOG as Exercise[];

type Screen =
  | 'loading'
  | 'setup'
  | 'baseline'
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
  | 'postureCompare'
  | 'conditioning'
  | 'settings'
  | 'askCoach';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [today, setToday] = useState<TodayState | undefined>();
  const [pillar, setPillar] = useState<PillarKind>('reset');
  const [error, setError] = useState<string | undefined>();
  const [coachNote, setCoachNote] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      const stored = await getProfile();
      if (!stored) {
        setScreen('setup');
        return;
      }
      setProfile(stored);
      // A profile that never took the baseline is still guessing at every
      // load, so the test comes before anything else.
      if (!stored.baselineCompletedAt) {
        setScreen('baseline');
        return;
      }
      await goToTodayOrReadiness(stored);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshToday(p: UserProfile, readiness?: number): Promise<TodayState | undefined> {
    try {
      const state = await loadToday(catalog, p, Date.now(), readiness);
      setToday(state);
      setScreen('today');
      return state;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading today.');
      return undefined;
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
    setScreen('baseline');
  }

  async function handleBaselineDone(p: UserProfile) {
    setProfile(p);
    await goToTodayOrReadiness(p);
  }

  /**
   * Skipping still resolves the question — otherwise every relaunch lands
   * back on the baseline screen forever, since `baselineCompletedAt` is
   * what stops it being asked twice and nothing was ever setting it here.
   */
  async function handleBaselineSkip(p: UserProfile) {
    const updated: UserProfile = { ...p, baselineCompletedAt: Date.now() };
    await saveProfile(updated);
    setProfile(updated);
    await goToTodayOrReadiness(updated);
  }

  /**
   * `loadToday` persists a session record the moment readiness is answered —
   * well before Start is pressed — so by the time this control is visible,
   * today's exercises are already committed to storage against the OLD gym.
   * Simply calling `refreshToday` again would just hand back that same
   * prescription (`loadToday` sees the existing record and resumes it).
   * `discardUntouchedSession` clears it first — safe here specifically
   * because Today only shows this control while `!resumed`, i.e. nothing
   * has been trained against it yet; it refuses to run (and this becomes a
   * no-op) if any set has actually been logged.
   */
  async function handleSwitchGym(gymId: GymId) {
    if (!profile) return;
    await discardUntouchedSession();
    const updated: UserProfile = { ...profile, activeGymId: gymId };
    await saveProfile(updated);
    setProfile(updated);
    await refreshToday(updated);
  }

  /**
   * Rebuilds just the one slot around a manually chosen exercise, using the
   * exact same prescription math a fresh generation would (see
   * `swapExerciseInSlot`), then swaps only that slot into the in-memory
   * prescription — every other exercise, and anything already logged, is
   * untouched.
   */
  async function handleSwapExercise(slotId: string, newExerciseId: string) {
    if (!profile || !today) return;
    try {
      const updated = await swapExercise({
        sessionId: today.sessionId,
        slotId,
        newExerciseId,
        catalog,
        profile,
        at: Date.now(),
      });
      setToday({ ...today, prescription: updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not swap that exercise.');
    }
  }

  function handleLoadSwapCandidates(slotId: string) {
    if (!profile) return Promise.resolve([]);
    return swapCandidates(catalog, profile, slotId, Date.now());
  }

  async function handleReadinessSelected(value: number) {
    if (!profile) return;
    setCoachNote(undefined);
    const state = await refreshToday(profile, value);
    if (!state) return;

    // Fire-and-forget: never blocks getting to Today, and a failed or
    // unreachable coach (e.g. /api/coach doesn't exist in local dev)
    // just means no note appears — the screen already rendered without it.
    void askCoach(
      buildReadinessPrompt({
        readiness: value,
        dayName: state.prescription.dayName,
        isDeload: state.prescription.isDeload,
        weekNumber: state.prescription.weekNumber,
        blockWeeks: state.block.weeks,
      }),
    ).then((result) => {
      if (result.ok) setCoachNote(result.text);
    });
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

  if (screen === 'baseline' && profile) {
    return (
      <BaselineTest
        profile={profile}
        onComplete={(p) => void handleBaselineDone(p)}
        onSkip={() => void handleBaselineSkip(profile)}
      />
    );
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
        coachNote={coachNote}
        gyms={profile.gyms}
        activeGymId={profile.activeGymId}
        onSwitchGym={(gymId) => void handleSwitchGym(gymId)}
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
        onOpenAskCoach={() => setScreen('askCoach')}
        onSwapExercise={(slotId, exerciseId) => void handleSwapExercise(slotId, exerciseId)}
        loadSwapCandidates={handleLoadSwapCandidates}
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
      <PostureHistory
        onBack={() => setScreen('today')}
        onNewScan={() => setScreen('postureScan')}
        onCompare={() => setScreen('postureCompare')}
      />
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

  if (screen === 'postureCompare') {
    return <PostureCompare onBack={() => setScreen('postureHistory')} />;
  }

  if (screen === 'conditioning') {
    return (
      <ConditioningLogForm onSaved={() => setScreen('today')} onCancel={() => setScreen('today')} />
    );
  }

  if (screen === 'askCoach') {
    return <AskCoach onBack={() => setScreen('today')} />;
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
        onFinishEarly={() => {
          void (async () => {
            await completeSession(Date.now());
            await goToTodayOrReadiness(profile);
          })();
        }}
        onPause={() => {
          // A raw setScreen('today') would reuse the stale `today.resumed`
          // captured before this session existed, showing "Start" on a
          // session that's actually still active. Re-running the normal
          // today-load path picks up the now-active record and correctly
          // flips the button to "Continue".
          void refreshToday(profile);
        }}
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
