'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { listMaintenanceDueAction } from '@/lib/actions/machines.actions';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import type { MaintenanceDueRow } from '@/types';

interface MaintenanceDueWidgetProps {
  wsId: string;
}

/**
 * Dashboard widget - top 5 maintenance-due rows + "View all" link.
 * Sub-feature gated on `machines_maintenance` so workspaces without the
 * feature don't see an empty card.
 *
 * Phase 24 Plan 24-12 - MACH-P2-04a alert surface (dashboard).
 */
export function MaintenanceDueWidget({ wsId }: MaintenanceDueWidgetProps) {
  return (
    <FeatureGate module="machines" subFeature="machines_maintenance" fallback={null}>
      <MaintenanceDueWidgetInner wsId={wsId} />
    </FeatureGate>
  );
}

function MaintenanceDueWidgetInner({ wsId }: MaintenanceDueWidgetProps) {
  const t = useTranslations('machines-maintenance');
  const [rows, setRows] = useState<MaintenanceDueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    (async () => {
      try {
        const result = await listMaintenanceDueAction(wsId, {
          limit: 5,
          offset: 0,
        });
        if (cancelled) return;
        startTransition(() => {
          setRows(result.items ?? []);
          setTotal(result.total ?? 0);
        });
      } catch {
        if (!cancelled) {
          startTransition(() => {
            setRows([]);
            setTotal(0);
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  return (
    <Card
      title={
        <span className="flex items-center gap-2 font-display font-bold">
          <ToolOutlined style={{ color: 'var(--cr-warning-700)' }} />
          {t('dashboard.widgetTitle')}
          {total > 0 ? (
            <span className="text-xs font-semibold" style={{ color: 'var(--cr-warning-700)' }}>
              ({total})
            </span>
          ) : null}
        </span>
      }
      extra={
        <Link
          href="/dashboard/maintenance/due"
          className="text-xs font-semibold"
          style={{ color: 'var(--cr-info-500)' }}
        >
          {t('dashboard.viewAll')} →
        </Link>
      }
      style={{
        borderRadius: 16,
        border: '1px solid var(--cr-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      styles={{ body: { padding: 20 } }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : rows.length === 0 ? (
        <div className="text-xs" style={{ color: 'var(--cr-text-3)' }}>
          {t('dashboard.empty')}
        </div>
      ) : (
        <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>
          {rows.map((r) => (
            <li
              key={r.scheduleId}
              className="flex items-center justify-between gap-2 py-1.5"
              style={{ borderBottom: '1px solid var(--cr-border-light)' }}
            >
              <Link
                href={`/dashboard/machines/${r.machineId}?tab=maintenance-logs`}
                className="flex-1 overflow-hidden"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <div
                  className="overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap"
                  style={{ color: 'var(--cr-text)' }}
                >
                  {r.machineName}
                </div>
                <div
                  className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap"
                  style={{ color: 'var(--cr-text-3)' }}
                >
                  {r.scheduleName}
                </div>
              </Link>
              <span
                className="rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{
                  background: r.daysRemaining < 0 ? 'var(--cr-danger-50)' : 'var(--cr-warning-50)',
                  color: r.daysRemaining < 0 ? 'var(--cr-danger-700)' : 'var(--cr-warning-700)',
                }}
              >
                {r.daysRemaining < 0
                  ? t('alerts.overdue')
                  : t('alerts.daysRemaining', { n: r.daysRemaining })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
