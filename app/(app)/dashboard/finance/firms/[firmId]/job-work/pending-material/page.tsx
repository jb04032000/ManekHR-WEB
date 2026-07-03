'use client';
// Finance polish (job-work): i18n via finance.jobWork.pending; DsPageHeader title + InfoTooltip
// explaining pending material. KPI/filter logic unchanged. No data logic changed.
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Select, InputNumber, Skeleton, Spin, Empty } from 'antd';
import {
  TeamOutlined,
  InboxOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listJwLots } from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import PendingMaterialTable from '@/components/finance/job-work/PendingMaterialTable';
import type { JobWorkLot, Party } from '@/types';
import dayjs from 'dayjs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

function daysRemaining(dueReturnDate: string): number {
  return dayjs(dueReturnDate).diff(dayjs().startOf('day'), 'day');
}

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
}

function KpiCard({ title, value, icon, gradient }: KpiCardProps) {
  return (
    <div
      style={{
        background: gradient,
        borderRadius: 12,
        padding: 20,
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 22,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{title}</div>
      </div>
      <div style={{ fontSize: 32, opacity: 0.8 }}>{icon}</div>
    </div>
  );
}

export default function PendingMaterialPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const t = useTranslations('finance.jobWork');
  const tShared = useTranslations('finance.sales'); // shared listCommon.error* labels for the retry panel
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [lots, setLots] = useState<JobWorkLot[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  // Filters
  const [partyFilter, setPartyFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [daysMin, setDaysMin] = useState<number | null>(null);
  const [daysMax, setDaysMax] = useState<number | null>(null);

  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    listParties(wsId, firmId, { pageSize: 100 })
      .then((res) => setParties(res.items ?? []))
      .catch(() => {});
  }, [wsId, firmId, jobWorkAccess.isLocked]);

  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listJwLots(wsId, firmId, {
      partyId: partyFilter,
      status: statusFilter ?? 'pending,partial,deemed_supply',
    })
      .then(setLots)
      .catch(() => {
        setLots([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, firmId, partyFilter, statusFilter, reloadKey, jobWorkAccess.isLocked]);

  // Apply client-side days-range filter - must be before any early return (Rules of Hooks)
  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      const days = daysRemaining(l.dueReturnDate);
      if (daysMin !== null && days < daysMin) return false;
      if (daysMax !== null && days > daysMax) return false;
      return true;
    });
  }, [lots, daysMin, daysMax]);

  if (jobWorkAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (jobWorkAccess.isLocked) {
    return <ModuleLockedPage module="job_work" />;
  }

  // KPI computations (client-side from fetched data)
  const uniquePrincipals = new Set(lots.map((l) => String(l.principalPartyId))).size;
  const lotsInCustody = lots.filter((l) => l.status === 'pending' || l.status === 'partial').length;
  const lotsExpiring30 = lots.filter((l) => {
    const days = daysRemaining(l.dueReturnDate);
    return days <= 30 && days > 0 && l.status !== 'deemed_supply';
  }).length;
  const deemedSupplyLots = lots.filter(
    (l) => l.status === 'deemed_supply' || daysRemaining(l.dueReturnDate) <= 0,
  ).length;

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={t('pending.title')}
        icon={<InboxOutlined />}
        titleAside={<InfoTooltip text={t('pending.tip')} />}
        style={{ marginBottom: 24 }}
      />

      {/* KPI cards */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <Skeleton.Input key={i} active style={{ height: 96, width: '100%' }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <KpiCard
            title={t('pending.kpiActivePrincipals')}
            value={uniquePrincipals}
            icon={<TeamOutlined />}
            gradient="linear-gradient(135deg, var(--cr-info) 0%, var(--cr-info-700) 100%)"
          />
          <KpiCard
            title={t('pending.kpiLotsInCustody')}
            value={lotsInCustody}
            icon={<InboxOutlined />}
            gradient="linear-gradient(135deg, var(--cr-info-500) 0%, var(--cr-info-700) 100%)"
          />
          <KpiCard
            title={t('pending.kpiLotsExpiring')}
            value={lotsExpiring30}
            icon={<WarningOutlined />}
            gradient="linear-gradient(135deg, var(--cr-warning) 0%, var(--cr-warning-700) 100%)"
          />
          <KpiCard
            title={t('pending.kpiDeemedSupply')}
            value={deemedSupplyLots}
            icon={<ExclamationCircleOutlined />}
            gradient="linear-gradient(135deg, var(--cr-error) 0%, var(--cr-danger-700) 100%)"
          />
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          background: 'var(--cr-surface)',
          borderRadius: 8,
          padding: '12px 16px',
          border: '1px solid var(--cr-border)',
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Select
          aria-label={t('pending.filterPrincipalAria')}
          allowClear
          placeholder={t('pending.filterByPrincipal')}
          style={{ minWidth: 200 }}
          value={partyFilter}
          onChange={setPartyFilter}
          options={parties.map((p) => ({ value: p._id, label: p.name }))}
        />
        <Select
          aria-label={t('pending.filterStatusAria')}
          allowClear
          placeholder={t('pending.allStatuses')}
          style={{ minWidth: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'pending', label: t('pending.statePending') },
            { value: 'partial', label: t('pending.statePartial') },
            { value: 'deemed_supply', label: t('pending.stateDeemedSupply') },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
            {t('pending.daysRemaining')}
          </span>
          <InputNumber
            aria-label={t('pending.daysMinAria')}
            placeholder={t('pending.daysMin')}
            value={daysMin}
            min={0}
            style={{ width: 80 }}
            onChange={(v) => setDaysMin(v)}
          />
          <span style={{ color: 'var(--cr-text-3)' }}>–</span>
          <InputNumber
            aria-label={t('pending.daysMaxAria')}
            placeholder={t('pending.daysMax')}
            value={daysMax}
            min={0}
            style={{ width: 80 }}
            onChange={(v) => setDaysMax(v)}
          />
        </div>
      </div>

      {/* Table */}
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton.Input key={i} active style={{ height: 44, width: '100%' }} />
          ))}
        </div>
      ) : filteredLots.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {t('pending.emptyTitle')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>
                {t('pending.emptyBody')}
              </div>
            </div>
          }
        />
      ) : (
        <PendingMaterialTable wsId={wsId} firmId={firmId} lots={filteredLots} />
      )}
    </div>
  );
}
