'use client';

/**
 * Phase 25 / Plan 25-12 - Per-machine trend page.
 *
 * Drilldown surface - output + uptime trends for a single machine across a
 * date range (default last 30 days). Granularity is server-derived per D-11.
 */
import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Skeleton, DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { utilisationApi } from '@/lib/api/modules/utilisation.api';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import OutputTrendChart from '@/components/utilisation/OutputTrendChart';
import UptimeTrendChart from '@/components/utilisation/UptimeTrendChart';
import DsCard from '@/components/ui/DsCard';
import type { TrendResponse } from '@/types';

const { RangePicker } = DatePicker;

export default function MachineTrendPage() {
  return (
    <FeatureGate module="machines" subFeature="production_utilisation_dashboard" as="h1">
      <Inner />
    </FeatureGate>
  );
}

function Inner() {
  const t = useTranslations('dashboard-production-utilisation');
  const { currentWorkspaceId } = useWorkspaceStore();
  const params = useParams<{ machineId: string }>();
  const machineId = params?.machineId ?? '';

  const [from, setFrom] = useState<string>(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !machineId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const res = await utilisationApi.getTrend(currentWorkspaceId, machineId, { from, to });
      startTransition(() => {
        setTrend(res);
      });
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data
        ?.error?.code;
      startTransition(() => {
        if (code === 'RANGE_TOO_LARGE') setError(t('errors.RANGE_TOO_LARGE'));
        else setError(t('errors.GENERIC'));
      });
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, machineId, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!currentWorkspaceId) return null;

  return (
    <div
      className="flex flex-col gap-5"
      style={{ padding: 24, background: 'var(--cr-bg)', margin: -24, minHeight: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 22,
              margin: 0,
              color: 'var(--cr-text)',
            }}
          >
            {t('page.title')}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--cr-text-3)',
              margin: '4px 0 0',
            }}
          >
            {t('trend.defaultRangeNote')}
          </p>
        </div>
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('trend.rangeLabel')}
          </label>
          <RangePicker
            value={[dayjs(from), dayjs(to)] as [Dayjs, Dayjs]}
            onChange={(vals) => {
              if (vals?.[0]) setFrom(vals[0].format('YYYY-MM-DD'));
              if (vals?.[1]) setTo(vals[1].format('YYYY-MM-DD'));
            }}
            allowClear={false}
          />
        </div>
      </div>

      {error ? (
        <Alert type="error" title={error} showIcon />
      ) : loading && !trend ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !trend || trend.points.length === 0 ? (
        <DsCard>
          <Alert type="info" title={t('empty.title')} description={t('empty.cta')} showIcon />
        </DsCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OutputTrendChart
            data={trend.points}
            metric={t(`trend.granularity.${trend.granularity}`)}
          />
          <UptimeTrendChart data={trend.points} />
        </div>
      )}
    </div>
  );
}
