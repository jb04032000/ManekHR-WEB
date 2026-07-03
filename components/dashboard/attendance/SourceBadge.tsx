'use client';
import type { ReactNode } from 'react';
import { Tooltip } from 'antd';
import {
  UserOutlined,
  InfoCircleOutlined,
  ScanOutlined,
  ApiOutlined,
  FileOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DesktopOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { AttendanceEventSource } from '@/types';

// Source icon + label map - D-26 spec.
// Exported so AttendanceMonthlyGrid can reuse SOURCE_META for tooltip text.
export const SOURCE_META: Record<AttendanceEventSource, { icon: ReactNode; label: string }> = {
  manual: { icon: <UserOutlined />, label: 'Manual' },
  manual_override: { icon: <InfoCircleOutlined />, label: 'Manual override' },
  device_push: { icon: <ScanOutlined />, label: 'Biometric device' },
  connector: { icon: <ApiOutlined />, label: 'Connector agent' },
  file_upload: { icon: <FileOutlined />, label: 'File upload' },
  auto_cron: { icon: <ClockCircleOutlined />, label: 'Auto (system)' },
  regularization: { icon: <FileTextOutlined />, label: 'Regularization' },
  kiosk: { icon: <DesktopOutlined />, label: 'Kiosk' },
};

/**
 * Renders a small icon with a tooltip showing the source label.
 * Returns null when source is null/undefined or unrecognised.
 * D-26: placed inline next to status text in DailyTable, MonthlyGrid tooltip, DetailDrawer.
 */
export function SourceBadge({
  source,
}: {
  source: AttendanceEventSource | string | null | undefined;
}) {
  if (!source) return null;
  const meta = SOURCE_META[source as AttendanceEventSource];
  if (!meta) return null;
  return (
    <Tooltip title={meta.label}>
      <span
        className="ml-1 inline-flex items-center text-xs text-faint"
        aria-label={`Source: ${meta.label}`}
        style={{ cursor: 'default' }}
      >
        {meta.icon}
      </span>
    </Tooltip>
  );
}

/**
 * Renders a lock icon with tooltip "Locked - payroll generated".
 * D-27: placed next to status when row.isLocked === true.
 */
export function LockBadge() {
  const t = useTranslations('attendance.sourceBadge');
  return (
    <Tooltip title={t('lockedTooltip')}>
      <span
        className="ml-1 inline-flex items-center text-xs text-amber-700"
        aria-label={t('lockedAria')}
        style={{ cursor: 'default' }}
      >
        <LockOutlined />
      </span>
    </Tooltip>
  );
}
