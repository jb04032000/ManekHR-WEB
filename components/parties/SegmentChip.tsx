'use client';
/**
 * SegmentChip - colored Tag for a party's RFM segment (Phase 17 / D-03).
 * Six segments: NEW / REGULAR / VIP / DORMANT / CHURNED / BLACKLIST.
 * All labels via the `party-intelligence` next-intl namespace (D-37).
 */

import { Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { PartySegment } from '@/types';

const COLOR_MAP: Record<PartySegment, string> = {
  NEW: 'blue',
  REGULAR: 'default',
  VIP: 'gold',
  DORMANT: 'orange',
  CHURNED: 'red',
  BLACKLIST: 'black',
};

interface Props {
  segment?: PartySegment | null;
  size?: 'sm' | 'md';
}

export default function SegmentChip({ segment, size = 'sm' }: Props) {
  const t = useTranslations('party-intelligence.segment');
  if (!segment) {
    return <span style={{ color: 'var(--cr-neutral-300)' }}>-</span>;
  }
  const fontSize = size === 'md' ? 13 : 11;
  return (
    <Tag color={COLOR_MAP[segment]} style={{ fontSize, fontWeight: 600 }}>
      {t(segment)}
    </Tag>
  );
}
