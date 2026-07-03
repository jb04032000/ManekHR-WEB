'use client';
import { useEffect, useState } from 'react';
import { Timeline, Skeleton, Button, Tag, Tooltip } from 'antd';
import type { TimelineItemProps } from 'antd';
import {
  ArrowLeftOutlined,
  LoginOutlined,
  LogoutOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { getAttendanceAudit } from '@/lib/actions/attendance.actions';
import { SOURCE_META } from '@/components/dashboard/attendance/SourceBadge';
import { DsEmptyState, DsPageHeader } from '@/components/ui';
import type { AuditItem, AttendanceEventSource } from '@/types';

interface AuditClientProps {
  attendanceId: string;
}

function fmt(date: string | Date) {
  return dayjs(date).format('hh:mm A, DD MMM YYYY');
}

type AuditT = ReturnType<typeof useTranslations<'attendance.audit'>>;

function buildItems(items: AuditItem[], t: AuditT): TimelineItemProps[] {
  const punchLabel = (punchType: string): { label: string; icon: React.ReactNode } => {
    const map: Record<string, { label: string; icon: React.ReactNode }> = {
      CHECK_IN: { label: t('punch.checkIn'), icon: <LoginOutlined /> },
      CHECK_OUT: { label: t('punch.checkOut'), icon: <LogoutOutlined /> },
      STATUS_SET: { label: t('punch.statusSet'), icon: <CheckCircleOutlined /> },
      BREAK_OUT: { label: t('punch.breakOut'), icon: <ClockCircleOutlined /> },
      BREAK_IN: { label: t('punch.breakIn'), icon: <ClockCircleOutlined /> },
      OT_IN: { label: t('punch.otIn'), icon: <ClockCircleOutlined /> },
      OT_OUT: { label: t('punch.otOut'), icon: <ClockCircleOutlined /> },
    };
    return map[punchType] ?? { label: punchType, icon: <InfoCircleOutlined /> };
  };

  return items.map((item, idx) => {
    if (item.kind === 'event') {
      const punch = punchLabel(item.punchType);
      const sourceMeta = SOURCE_META[item.source as AttendanceEventSource];
      return {
        key: `e-${item.eventId}-${idx}`,
        color: item.voided ? 'gray' : 'blue',
        dot: item.voided ? (
          <StopOutlined style={{ fontSize: 14, color: 'var(--cr-text-5)' }} />
        ) : undefined,
        children: (
          <div className={`pb-1 ${item.voided ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[13px] font-semibold ${item.voided ? 'text-faint line-through' : 'text-slate-800'}`}
              >
                {punch.label}
              </span>
              {sourceMeta && (
                <Tooltip title={sourceMeta.label}>
                  <Tag variant="filled" className="text-xs leading-tight" color="blue">
                    {sourceMeta.label}
                  </Tag>
                </Tooltip>
              )}
              {item.voided && (
                <Tag color="red" variant="filled" className="text-xs">
                  {t('voided')}
                </Tag>
              )}
            </div>
            <p className="m-0 mt-0.5 text-xs text-gray-700">
              {fmt(item.at)}
              {item.by && <span className="mx-1">·</span>}
              {item.by && (
                <span>
                  {t('byPrefix')} <strong className="text-gray-600">{item.by.name}</strong>
                </span>
              )}
              {item.verifyMethod && <span className="ml-1 text-faint">({item.verifyMethod})</span>}
            </p>
            {item.voided && item.voidReason && (
              <p className="m-0 mt-1 text-xs text-red-700">
                {t('voidReason', { reason: item.voidReason })}
              </p>
            )}
          </div>
        ),
      };
    }

    if (item.kind === 'void') {
      return {
        key: `v-${item.eventId}-${idx}`,
        color: 'red',
        children: (
          <div className="pb-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-red-700">{t('eventVoided')}</span>
              <Tag color="red" variant="filled" className="text-xs">
                #{item.eventId.slice(-6)}
              </Tag>
            </div>
            <p className="m-0 mt-0.5 text-xs text-gray-700">
              {fmt(item.at)}
              {item.by && <span className="mx-1">·</span>}
              {item.by && (
                <span>
                  {t('byPrefix')} <strong className="text-gray-600">{item.by.name}</strong>
                </span>
              )}
            </p>
            {item.reason && (
              <p className="m-0 mt-1 text-xs text-gray-700 italic">&ldquo;{item.reason}&rdquo;</p>
            )}
          </div>
        ),
      };
    }

    // status_history
    return {
      key: `s-${item.at}-${idx}`,
      color: 'green',
      children: (
        <div className="pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-800">{t('statusSetTo')}</span>
            <Tag color="green" variant="filled" className="text-xs capitalize">
              {item.status.replace(/_/g, ' ')}
            </Tag>
          </div>
          <p className="m-0 mt-0.5 text-xs text-gray-700">
            {fmt(item.at)}
            {item.by && <span className="mx-1">·</span>}
            {item.by && (
              <span>
                {t('byPrefix')} <strong className="text-gray-600">{item.by.name}</strong>
              </span>
            )}
          </p>
        </div>
      ),
    };
  });
}

export default function AuditClient({ attendanceId }: AuditClientProps) {
  const t = useTranslations('attendance.audit');
  const tDenied = useTranslations('attendance.anomalies');
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  // RBAC gate - the BE GET /attendance/:id/audit endpoint requires
  // attendance.view at scope 'all'. Mirrors the AnomaliesPage scope-gate.
  const { canPath, data: perms, loading: permsLoading } = useMyPermissions();
  const canViewAudit = !!perms?.isOwner || canPath('attendance.record.view', 'all');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Do not fire the org-wide audit fetch until RBAC clears it.
    if (!wsId || permsLoading || !canViewAudit) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await getAttendanceAudit(wsId, attendanceId);
        if (!cancelled) setItems(data);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t('failLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, attendanceId, permsLoading, canViewAudit]);

  if (permsLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Skeleton active paragraph={{ rows: 1 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!canViewAudit) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <DsPageHeader title={t('pageTitle')} icon={<LockOutlined />} />
        <DsEmptyState
          icon="🔒"
          title={tDenied('accessDenied.title')}
          sub={tDenied('accessDenied.message')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/attendance">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            size="small"
            aria-label={t('backAria')}
          />
        </Link>
        <div>
          <h2 className="m-0 text-xl font-bold text-slate-800">{t('pageTitle')}</h2>
          <p className="m-0 mt-0.5 text-xs text-faint">
            {t('recordLabel')}{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">{attendanceId}</code>
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} active paragraph={{ rows: 1 }} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">{t('emptyText')}</div>
      )}

      {/* Timeline */}
      {!loading && !error && items.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-5">
          <Timeline items={buildItems(items, t)} />
        </div>
      )}
    </div>
  );
}
