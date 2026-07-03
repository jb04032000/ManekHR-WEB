'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ToolOutlined } from '@ant-design/icons';

interface MaintenanceDueBadgeProps {
  count: number;
  wsId: string;
  machineId: string;
}

/**
 * Amber "Maintenance Due" badge surfaced on machine list rows + machine detail
 * pages. Auto-hides when count <= 0. Clicking navigates to the machine's
 * maintenance-logs tab pre-filtered to due schedules.
 *
 * Phase 24 Plan 24-12 - MACH-P2-04a alert surface.
 */
export function MaintenanceDueBadge({ count, wsId: _wsId, machineId }: MaintenanceDueBadgeProps) {
  const t = useTranslations('machines-maintenance');
  if (!count || count <= 0) return null;

  return (
    <Link
      href={`/dashboard/machines/${machineId}?tab=maintenance-logs&filter=due`}
      className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900 transition-colors hover:bg-amber-100"
      style={{
        backgroundColor: 'var(--cr-warning-50)',
        color: 'var(--cr-warning-700)',
        border: '1px solid var(--cr-warning-50)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
      aria-label={`${t('alerts.dueBadge')}: ${count}`}
    >
      <ToolOutlined style={{ fontSize: 11 }} />
      <span>{t('alerts.dueBadge')}</span>
      <span style={{ fontWeight: 600 }}>{count}</span>
    </Link>
  );
}
