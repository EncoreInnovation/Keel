/**
 * App shell — a plain state machine, no router. Four tab screens (Today,
 * Recover, Progress, More) sit behind a bottom bar; everything else is a
 * sub-screen that returns to the tab it was opened from. The workout itself
 * stays one linear path: Today → Arrive → Session → Downshift → back to Today,
 * with the tab bar hidden so nothing competes with the set in front of you.
 */

import { useEffect, useState, type ReactNode } from 'react';
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
import { PhysiqueCheckin } from './ui/PhysiqueCheckin';
import { PhysiqueCompare } from './ui/PhysiqueCompare';
import { PostureHistory } from './ui/PostureHistory';
import { PostureScan } from './ui/PostureScan';
import { Progress } from './ui/Progress';
import { Roadmap } from './ui/Roadmap';
import { RecoveryMap } from './ui/RecoveryMap';
import { SessionPlayer } from './ui/SessionPlayer';
import { Settings } from './ui/Settings';
import { Setup } from './ui/Setup';
import { Today } from './ui/Today';
import { TabBar, type Tab } from './ui/TabBar';
import { RecoverHub } from './ui/RecoverHub';
import { ProgressHub } from './ui/ProgressHub';
import { MoreHub } from './ui/MoreHub';
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
  setExpress,
  swapCandidates,
  swapExercise,
  type TodayState,
} from './state/sessionController';
import { getPillarLogs, getProfile, saveProfile, updateActiveSessionMeta } from './storage/repository';
import { pelvicFloorSession } from './pillars/pelvicFloor';
import type { PillarSession } from './pillars/types';
import type { Exercise, GymId, PillarKind, UserProfile } from './engine/types';

const catalog = CATALOG as Exercise[];

type Screen =
  | 'loading'
  | 'setup'
  | 'baseline'
  | 'readiness'
  | 'today'
  | 'recover'
  | 'progressHub'
  | 'more'
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
  | 'askCoach'
  | 'roadmap'
  | 'physiqueCheckin'
  | 'physiqueCompare';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [today, setToday] = useState<TodayState | undefined>();
  const [pillar, setPillar] = useState<PillarKind>('reset');
  const [pillarSession, setPillarSession] = useState<PillarSession | undefined>();
  const [lastTab, setLastTab] = useState<Tab>('today');
  const [error, setError] = useState<string | undefined>();
  const [coachNote, setCoachNote] = useState<string | undefined>();
  const [cueWord, setCueWord] = useState<string | undefined>();
  const [fullPrescription, setFullPrescription] = useState<TodayState['prescription'] | undefined>();

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
      setLastTab('today');
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

  async function handleToggleExpress() {
    if (!today) return;
    try {
      if (today.prescription.express && fullPrescription) {
        const restored = await setExpress(today.sessionId, fullPrescription);
        setFullPrescription(undefined);
        setToday({ ...today, prescription: restored });
      } else {
        setFullPrescription(today.prescription);
        const short = await setExpress(today.sessionId);
        setToday({ ...today, prescription: short });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the session.');
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

  const goTab = (tab: Tab) => {
    setLastTab(tab);
    setScreen(tab);
  };
  const back = () => setScreen(lastTab);
  const openPillar = (kind: PillarKind) => {
    setPillar(kind);
    setPillarSession(undefined);
    if (kind === 'pelvic') {
      void getPillarLogs().then((logs) =>
        setPillarSession(pelvicFloorSession(logs.filter((l) => l.kind === 'pelvic' && l.completedAt).length)),
      );
    }
    setScreen('pillar');
  };
  const withTabs = (tab: Tab, content: ReactNode) => (
    <div className="with-tabs">
      {content}
      <TabBar active={tab} onSelect={goTab} />
    </div>
  );

  if (screen === 'today') {
    return withTabs(
      'today',
      <Today
        prescription={today.prescription}
        weeksTotal={today.block.weeks}
        resumed={today.resumed}
        coachNote={coachNote}
        gyms={profile.gyms}
        activeGymId={profile.activeGymId}
        onSwitchGym={(gymId) => void handleSwitchGym(gymId)}
        onStart={handleStart}
        onOpenPillar={openPillar}
        onOpenConditioning={() => setScreen('conditioning')}
        onOpenRoadmap={() => setScreen('roadmap')}
        onToggleExpress={() => void handleToggleExpress()}
        onOpenPhysiqueCheckin={() => setScreen('physiqueCheckin')}
        onSwapExercise={(slotId, exerciseId) => void handleSwapExercise(slotId, exerciseId)}
        loadSwapCandidates={handleLoadSwapCandidates}
      />,
    );
  }

  if (screen === 'recover') {
    return withTabs(
      'recover',
      <RecoverHub
        prescription={today.prescription}
        onOpenPillar={openPillar}
        onOpenRecovery={() => setScreen('recovery')}
      />,
    );
  }

  if (screen === 'progressHub') {
    return withTabs(
      'progressHub',
      <ProgressHub
        onOpenRoadmap={() => setScreen('roadmap')}
        onOpenProgress={() => setScreen('progress')}
        onOpenPhysique={() => setScreen('physiqueCompare')}
        onNewPhysique={() => setScreen('physiqueCheckin')}
        onOpenPosture={() => setScreen('postureHistory')}
        onOpenAsymmetry={() => setScreen('asymmetry')}
        onOpenPillar={openPillar}
      />,
    );
  }

  if (screen === 'more') {
    return withTabs(
      'more',
      <MoreHub
        onOpenConditioning={() => setScreen('conditioning')}
        onOpenAskCoach={() => setScreen('askCoach')}
        onOpenSettings={() => setScreen('settings')}
      />,
    );
  }

  if (screen === 'pillar') {
    if (pillar === 'pelvic' && !pillarSession) return <div className="today today--loading">Loading…</div>;
    return <PillarPlayer session={pillarSession ?? PILLAR_SESSIONS[pillar]} onComplete={back} />;
  }

  if (screen === 'asymmetry') {
    return <Asymmetry onBack={back} />;
  }

  if (screen === 'recovery') {
    return <RecoveryMap onBack={back} />;
  }

  if (screen === 'progress') {
    return (
      <Progress
        onBack={back}
        onOpenAsymmetry={() => setScreen('asymmetry')}
        onOpenPhysique={() => setScreen('physiqueCompare')}
        onNewPhysique={() => setScreen('physiqueCheckin')}
      />
    );
  }

  if (screen === 'postureHistory') {
    return (
      <PostureHistory
        onBack={back}
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
      <ConditioningLogForm onSaved={back} onCancel={back} />
    );
  }

  if (screen === 'physiqueCheckin') {
    return <PhysiqueCheckin onSaved={() => setScreen('physiqueCompare')} onCancel={back} />;
  }

  if (screen === 'physiqueCompare') {
    return <PhysiqueCompare onBack={back} />;
  }

  if (screen === 'roadmap') {
    return <Roadmap onBack={back} />;
  }

  if (screen === 'askCoach') {
    return <AskCoach onBack={back} />;
  }

  if (screen === 'settings') {
    return (
      <Settings
        profile={profile}
        onSaved={(updated) => setProfile(updated)}
        onBack={back}
      />
    );
  }

  if (screen === 'arrive') {
    return (
      <ArrivePhase
        dayId={today.prescription.dayId}
        onComplete={(cue) => {
          setCueWord(cue);
          void updateActiveSessionMeta({ cueWord: cue });
          setScreen('session');
        }}
      />
    );
  }

  if (screen === 'session') {
    return (
      <SessionPlayer
        sessionId={today.sessionId}
        block={today.block}
        profile={profile}
        initialPrescription={today.prescription}
        cueWord={cueWord}
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
        onComplete={async (reflection) => {
          if (reflection) await updateActiveSessionMeta({ notes: reflection });
          await completeSession(Date.now());
          await goToTodayOrReadiness(profile);
        }}
      />
    );
  }

  return null;
}
