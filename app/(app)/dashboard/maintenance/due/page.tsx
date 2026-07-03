'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { Pagination, Skeleton } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { listMaintenanceDueAction } from '@/lib/actions/machines.actions';
import { DsCard, DsPageHeader, DsTable, DsEmptyState, DsTag } from '@/components/ui';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import type { MaintenanceDueRow } from '@/types';

const PAGE_SIZE = 25;

export default function MaintenanceDuePage() {
  const t = useTranslations('machines-maintenance');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();

  const [rows, setRows] = useState<MaintenanceDueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const machinesModuleAccess = entitlements?.moduleAccess?.find((m) => m.module === 'machines');
  const hasModule = machinesModuleAccess?.enabled ?? false;
  const subFeature = machinesModuleAccess?.subFeatures?.find(
    (sf) => sf.key === 'machines_maintenance',
  );
  const hasMaintenance = !subFeature || subFeature.access !== 'locked';

  useEffect(() => {
    if (!currentWorkspaceId || !hasModule || !hasMaintenance) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    (async () => {
      try {
        const result = await listMaintenanceDueAction(currentWorkspaceId, {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
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
  }, [currentWorkspaceId, page, hasModule, hasMaintenance]);

  if (!isHydrated) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }
  if (!hasModule || !hasMaintenance) {
    return <ModuleLockedPage module="machines" />;
  }

  const columns = [
    {
      title: t('schedule.name'),
      dataIndex: 'scheduleName',
      key: 'scheduleName',
      render: (v: string, r: MaintenanceDueRow) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--cr-text)' }}>{v}</div>
          {r.scheduleCode ? (
            <div style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>{r.scheduleCode}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Machine',
      dataIndex: 'machineName',
      key: 'machineName',
      render: (_v: string, r: MaintenanceDueRow) => (
        <Link
          href={`/dashboard/machines/${r.machineId}?tab=maintenance-logs`}
          style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
        >
          {r.machineName}
        </Link>
      ),
    },
    {
      title: t('schedule.technician'),
      dataIndex: 'technicianName',
      key: 'technicianName',
      render: (v: string | undefined) => v ?? '-',
    },
    {
      title: t('schedule.nextDue'),
      dataIndex: 'nextDueAt',
      key: 'nextDueAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('alerts.dueBadge'),
      dataIndex: 'daysRemaining',
      key: 'daysRemaining',
      width: 160,
      render: (v: number) =>
        v < 0 ? (
          <DsTag status="danger" label={t('alerts.overdue')} />
        ) : (
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--cr-warning-50)', color: 'var(--cr-warning-700)' }}
          >
            {t('alerts.daysRemaining', { n: v })}
          </span>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DsPageHeader
        title={t('dashboard.widgetTitle')}
        sub={`${total} ${total === 1 ? 'item' : 'items'}`}
        icon={<ToolOutlined />}
      />

      <DsCard noPad>
        <DsTable
          rowKey="scheduleId"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          locale={{
            emptyText: (
              <DsEmptyState
                title={t('dashboard.empty')}
                sub="No maintenance schedules require action right now."
              />
            ),
          }}
        />
        {total > PAGE_SIZE && (
          <div
            style={{
              padding: 16,
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: '1px solid var(--cr-border)',
            }}
          >
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              showSizeChanger={false}
              onChange={setPage}
            />
          </div>
        )}
      </DsCard>
    </div>
  );
}
