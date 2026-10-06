/**
 * Monthly physique photos — front, side, back. Same spot, same light, same
 * time of day (morning, before eating) each month, so the comparison shows
 * the body changing and not the lighting. Stored on this device only.
 */

import { useState } from 'react';
import { PHYSIQUE_VIEWS, type PhysiqueView } from '../engine/types';
import { savePhysiqueLog } from '../storage/repository';
import { downscaleImage } from './image';

const LABEL: Record<PhysiqueView, string> = { front: 'Front', side: 'Side', back: 'Rear' };

export interface PhysiqueCheckinProps {
  onSaved: () => void;
  onCancel: () => void;
}

export function PhysiqueCheckin({ onSaved, onCancel }: PhysiqueCheckinProps) {
  const [photos, setPhotos] = useState<Partial<Record<PhysiqueView, Blob>>>({});
  const [previews, setPreviews] = useState<Partial<Record<PhysiqueView, string>>>({});
  const [saving, setSaving] = useState(false);

  const handlePick = async (view: PhysiqueView, file: File | undefined) => {
    if (!file) return;
    const small = await downscaleImage(file);
    setPhotos((p) => ({ ...p, [view]: small }));
    setPreviews((p) => {
      if (p[view]) URL.revokeObjectURL(p[view]!);
      return { ...p, [view]: URL.createObjectURL(small) };
    });
  };

  const views = PHYSIQUE_VIEWS.filter((v) => photos[v]);

  const handleSave = async () => {
    if (views.length === 0) return;
    setSaving(true);
    await savePhysiqueLog({ id: `phys-${Date.now()}`, at: Date.now(), views }, photos);
    Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    setSaving(false);
    onSaved();
  };

  return (
    <div className="phase-screen physique-checkin">
      <div className="phase-screen__eyebrow">Physique check-in</div>
      <p className="placeholder__body">
        Same spot, same light, same time of day each month — morning, before eating. Relaxed, arms by your
        sides. Photos stay on this phone.
      </p>
      <div className="physique-checkin__grid">
        {PHYSIQUE_VIEWS.map((view) => (
          <label key={view} className="physique-checkin__slot">
            {previews[view] ? (
              <img src={previews[view]} alt={`${LABEL[view]} photo`} />
            ) : (
              <span className="physique-checkin__empty">+</span>
            )}
            <span className="physique-checkin__label">{LABEL[view]}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="physique-checkin__input"
              data-view={view}
              onChange={(e) => void handlePick(view, e.target.files?.[0])}
            />
          </label>
        ))}
      </div>
      <button className="btn btn--hero" disabled={views.length === 0 || saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : `Save ${views.length || ''} photo${views.length === 1 ? '' : 's'}`}
      </button>
      <button className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
