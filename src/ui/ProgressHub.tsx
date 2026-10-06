/**
 * Progress — "is it working?" One card per question, each with a live
 * status and how often it's worth checking, so nobody has to guess which
 * screen answers what.
 */

import { useEffect, useState } from 'react';
import { asymmetryReport, overallGap } from '../engine/asymmetry';
import { buildRoadmap, currentWeekIndex, daysUntil } from '../engine/roadmap';
import { alignmentSummary, type AlignmentSummary } from '../posture/describe';
import {
  getActiveBlock,
  getAllSets,
  getBlockHistory,
  getBodyMetrics,
  getPhysiqueLogs,
  getPostureLogs,
} from '../storage/repository';
import type { PillarKind } from '../engine/types';
import { describeGap } from './Asymmetry';
import { VolumeReadout } from './VolumeReadout';

export interface ProgressHubProps {
  onOpenRoadmap: () => void;
  onOpenProgress: () => void;
  onOpenPhysique: () => void;
  onNewPhysique: () => void;
  onOpenPosture: () => void;
  onOpenAsymmetry: () => void;
  onOpenPillar: (kind: PillarKind) => void;
}

interface Status {
  plan?: string;
  body?: string;
  physique?: string;
  alignment?: AlignmentSummary;
  balance?: string;
}

const DAY = 86_400_000;

function HubCard(props: { title: string; status: string; tells: string; check: string; onClick: () => void }) {
  return (
    <button className="hub-card" onClick={props.onClick}>
      <div className="hub-card__head">
        <span className="hub-card__title">{props.title}</span>
        <span className="hub-card__meta">›</span>
      </div>
      <div className="hub-card__status">{props.status}</div>
      <div className="hub-card__body">{props.tells}</div>
      <div className="hub-card__when">
        <strong>Check:</strong> {props.check}
      </div>
    </button>
  );
}

export function ProgressHub(props: ProgressHubProps) {
  const [status, setStatus] = useState<Status>({});

  useEffect(() => {
    void (async () => {
      const now = Date.now();
      const [history, active, metrics, physique, posture, sets] = await Promise.all([
        getBlockHistory(),
        getActiveBlock(),
        getBodyMetrics(),
        getPhysiqueLogs(),
        getPostureLogs(),
        getAllSets(),
      ]);
      const weeks = buildRoadmap(history[0]?.startedAt ?? active?.startedAt ?? now);
      const i = currentWeekIndex(weeks, now);
      const week = weeks[i]!;
      const phase = week.phase === 'build' ? 'Build' : week.phase === 'deload' ? 'Deload' : 'Retest';

      const waists = metrics.filter((m) => m.measurements?.waist !== undefined);
      const weights = metrics.filter((m) => m.weight !== undefined);
      const change = (xs: number[], unit: string) => {
        if (xs.length < 2) return undefined;
        const d = Math.round((xs.at(-1)! - xs[0]!) * 10) / 10;
        return `${d > 0 ? '+' : ''}${d} ${unit}`;
      };
      const waistChange = change(waists.map((m) => m.measurements!.waist!), 'in waist');
      const weightChange = change(weights.map((m) => m.weight!), 'lb');
      const body =
        waistChange || weightChange
          ? [waistChange, weightChange].filter(Boolean).join(' · ') + ' since you started'
          : weights.length || waists.length
            ? 'One check-in so far — the trend starts next week'
            : 'No weigh-ins yet';

      const lastPhoto = physique.at(-1);
      const unilateral = asymmetryReport(sets);

      setStatus({
        plan: `Week ${Math.min(i + 1, 12)} of 12 · ${phase} · ${daysUntil(weeks.at(-1)!.start, now)} days to retest`,
        body,
        physique: lastPhoto ? `Last photos ${Math.floor((now - lastPhoto.at) / DAY)} days ago` : 'No photos yet',
        alignment: alignmentSummary(posture, now),
        balance: unilateral.length ? describeGap(overallGap(unilateral)) : 'No one-sided lifts logged yet',
      });
    })();
  }, []);

  return (
    <div className="phase-screen hub">
      <div className="phase-screen__eyebrow">Progress</div>
      <p className="hub__intro">Is it working? Each card answers one question — and says how often it’s worth checking.</p>

      <HubCard
        title="Q4 plan"
        status={status.plan ?? '…'}
        tells="Where you are in the 12 weeks: build weeks, deloads, holidays, retest."
        check="Glance at it weekly."
        onClick={props.onOpenRoadmap}
      />
      <HubCard
        title="Strength & body"
        status={status.body ?? '…'}
        tells="Your lift strength trends, plus weight and waist. Waist shrinking while lifts hold or rise = fat loss with muscle kept."
        check="Weekly, right after the Today check-in."
        onClick={props.onOpenProgress}
      />
      <HubCard
        title="Physique photos"
        status={status.physique ?? '…'}
        tells="Front, side and rear photos with a before/after slider — the change the mirror hides week to week."
        check="Monthly. Same spot, same light, mornings."
        onClick={status.physique === 'No photos yet' ? props.onNewPhysique : props.onOpenPhysique}
      />

      <section className="hub__group">
        <VolumeReadout />
        <p className="hub__caption">
          Hard sets per muscle this week. 10–20 is the growth zone; under 10 means that muscle is falling behind. Check weekly.
        </p>
      </section>

      <HubCard
        title="Posture"
        status={status.alignment ? status.alignment.headline : 'No scan yet — take one to see which side is off'}
        tells="A camera scan measures hip and shoulder tilt. Watch the trend, not one reading."
        check="Every 2–4 weeks, same spot and stance each time."
        onClick={props.onOpenPosture}
      />
      {status.alignment && status.alignment.side !== 'level' && (
        <button className="btn btn--text" onClick={() => props.onOpenPillar('realign')}>
          Do the Realign routine for this ›
        </button>
      )}
      <HubCard
        title="Left / right balance"
        status={status.balance ?? '…'}
        tells="Built automatically from your one-sided lifts. A gap over 10% means the weaker side gets its sets first."
        check="Monthly — nothing to do but log your sets."
        onClick={props.onOpenAsymmetry}
      />
    </div>
  );
}
