'use client';

/**
 * Phase 25 / Plan 25-12 - Dashboard home widget.
 *
 * Three mini-cards (today output, MTD uptime %, top machine) with a "View
 * dashboard" link to the full page. Sub-feature gated via FeatureGate so
 * workspaces without entitlement never see an empty card.
 *
 * Mirrors `MaintenanceDueWidget` (Phase 24) layout/gating pattern.
 */
import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { BarChartOutlined } from '@ant-design/icons';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { utilisationApi } from '@/lib/api/modules/utilisation.api';
import type { ByMetricSums, KpiResponse, UptimeBand } from '@/types';

interface Props {
  wsId: string;
}

const BAND_COLOR: Record<UptimeBand, string> = {
  green: 'var(--cr-success-700)',
  amber: 'var(--cr-warning-700)',
  red: 'var(--cr-danger-700)',
};

function formatNumber(n: number): string {
  return Number(n).toLocaleString('en-IN');
}

function renderSums(sums: ByMetricSums, t: ReturnType<typeof useTranslations>): string {
  const entries = (Object.entries(sums) as Array<[keyof ByMetricSums, number]>).filter(
    ([, v]) => v > 0,
  );
  if (entries.length === 0) return t('kpi.noDataInline');
  if (entries.length === 1) {
    const [metric, value] = entries[0];
    return `${formatNumber(value)} ${t(`metric.${metric}`)}`;
  }
  return entries
    .map(([metric, value]) => `${formatNumber(value)} ${t(`metric.${metric}`)}`)
    .join(' | ');
}

export function ProductionAtAGlanceWidget({ wsId }: Props) {
  return (
    <FeatureGate module="machines" subFeature="production_utilisation_dashboard" fallback={null}>
      <ProductionAtAGlanceInner wsId={wsId} />
    </FeatureGate>
  );
}

function ProductionAtAGlanceInner({ wsId }: Props) {
  const t = useTranslations('dashboard-production-utilisation');
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    utilisationApi
      .getKpis(wsId)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setError(t('errors.GENERIC'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, t]);

  return (
    <Card
      title={
        <span className="flex items-center gap-2 font-display font-bold">
          <BarChartOutlined style={{ color: 'var(--cr-info-500)' }} />
          {t('widget.title')}
        </span>
      }
      extra={
        <Link
          href="/dashboard/production-utilisation"
          className="text-xs font-semibold"
          style={{ color: 'var(--cr-info-500)' }}
        >
          {t('widget.viewAll')} →
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
      ) : error ? (
        <div className="text-xs" style={{ color: 'var(--cr-error, var(--cr-danger-700))' }}>
          {error}
        </div>
      ) : !data ? (
        <div className="text-xs" style={{ color: 'var(--cr-text-3)' }}>
          {t('empty.title')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Mini label={t('widget.todayOutputCard')} value={renderSums(data.todayOutput, t)} />
          <Mini
            label={t('widget.uptimeCard')}
            value={`${data.uptime.actualPct.toFixed(1)}%`}
            valueColor={BAND_COLOR[data.uptime.band]}
          />
          <Mini
            label={t('widget.topMachineCard')}
            value={
              data.topMachines[0]
                ? `${data.topMachines[0].machineName} - ${formatNumber(data.topMachines[0].output)} ${t(`metric.${data.topMachines[0].metric}`)}`
                : t('kpi.noDataInline')
            }
          />
        </div>
      )}
    </Card>
  );
}

function Mini({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--cr-surface-2, var(--cr-bg))',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--cr-text-3)',
          marginBottom: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 16,
          color: valueColor ?? 'var(--cr-text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default ProductionAtAGlanceWidget;
