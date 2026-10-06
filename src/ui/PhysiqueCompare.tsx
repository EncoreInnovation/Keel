/** Before/after slider for monthly physique photos — see `PhotoCompare`. */

import { PHYSIQUE_VIEWS, type PhysiqueView } from '../engine/types';
import { getPhysiqueLogs, getPhysiquePhoto } from '../storage/repository';
import { PhotoCompare } from './PhotoCompare';

const LABEL: Record<PhysiqueView, string> = { front: 'Front', side: 'Side', back: 'Rear' };

export function PhysiqueCompare({ onBack }: { onBack: () => void }) {
  return (
    <PhotoCompare
      eyebrow="Physique"
      loadLogs={getPhysiqueLogs}
      loadPhoto={getPhysiquePhoto}
      viewOrder={PHYSIQUE_VIEWS}
      viewLabel={LABEL}
      onBack={onBack}
    />
  );
}
