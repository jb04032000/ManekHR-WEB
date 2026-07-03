'use client';
/**
 * PartyIntelligenceBadges - composes SegmentChip + GstinRiskBadge for table-row display.
 */

import SegmentChip from './SegmentChip';
import GstinRiskBadge from './GstinRiskBadge';
import type { PartyIntelligence } from '@/types';

interface Props {
  intelligence?: PartyIntelligence;
}

export default function PartyIntelligenceBadges({ intelligence }: Props) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <SegmentChip segment={intelligence?.segment} />
      <GstinRiskBadge
        level={intelligence?.gstinRiskLevel}
        lastVerifiedAt={intelligence?.gstinFilingsCheckedAt}
        lastError={intelligence?.gstinFilingsLastError}
      />
    </span>
  );
}
