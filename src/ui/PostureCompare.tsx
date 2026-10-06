/** Before/after slider for posture scans — see `PhotoCompare`. */

import { getPostureLogs, getPosturePhoto } from '../storage/repository';
import type { PostureView } from '../engine/types';
import { PhotoCompare } from './PhotoCompare';

const VIEWS = ['front', 'side'] as const satisfies readonly PostureView[];
const LABEL: Record<PostureView, string> = { front: 'Front', side: 'Side' };

export function PostureCompare({ onBack }: { onBack: () => void }) {
  return (
    <PhotoCompare
      eyebrow="Compare"
      loadLogs={getPostureLogs}
      loadPhoto={getPosturePhoto}
      viewOrder={VIEWS}
      viewLabel={LABEL}
      onBack={onBack}
    />
  );
}
