'use client';
/**
 * GstinRiskBadge - colored dot + label for GSTIN risk (Phase 17 / D-12).
 * Levels: OK / WATCH / RISK / CRITICAL.
 * Tooltip shows "Last verified: {ts}" and (if present) the last provider error.
 * D-14a - provider failures keep prior risk; tooltip exposes lastError.
 */

import { Tooltip, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { GstinRiskLevel } from '@/types';

const COLOR_MAP: Record<GstinRiskLevel, string> = {
  OK: 'green',
  WATCH: 'gold',
  RISK: 'orange',
  CRITICAL: 'red',
};

interface Props {
  level?: GstinRiskLevel | null;
  lastVerifiedAt?: string;
  lastError?: { at: string; message: string };
  size?: 'sm' | 'md';
}

function formatTs(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function GstinRiskBadge({ level, lastVerifiedAt, lastError, size = 'sm' }: Props) {
  const t = useTranslations('party-intelligence.gstin');
  if (!level) {
    return <span style={{ color: 'var(--cr-neutral-300)' }}>-</span>;
  }
  const tooltipBody = (
    <div style={{ fontSize: 12 }}>
      <div>
        {t('lastVerified')}: {formatTs(lastVerifiedAt)}
      </div>
      {lastError ? (
        <div style={{ color: 'var(--cr-warning-500)', marginTop: 4 }}>
          Last error: {lastError.message}
        </div>
      ) : null}
    </div>
  );
  const fontSize = size === 'md' ? 13 : 11;
  return (
    <Tooltip title={tooltipBody}>
      <Tag color={COLOR_MAP[level]} style={{ fontSize, fontWeight: 600 }}>
        {t(level)}
      </Tag>
    </Tooltip>
  );
}
