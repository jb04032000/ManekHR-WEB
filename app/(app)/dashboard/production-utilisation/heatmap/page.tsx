'use client';

/**
 * Phase 25 / Plan 25-12 - Per-location utilisation heatmap page.
 *
 * Month picker + location selector. Renders the Tailwind-grid HeatmapGrid
 * once a location is chosen. D-13 limits to month-only (no arbitrary range).
 */
import { useEffect, useState, useCallback, startTransition } from 'react';
import { Alert, Skeleton, DatePicker, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import http, { unwrap } from '@/lib/api/client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { utilisationApi } from '@/lib/api/modules/utilisation.api';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import HeatmapGrid from '@/components/utilisation/HeatmapGrid';
import DsCard from '@/components/ui/DsCard';
import type { HeatmapResponse } from '@/types';

interface OptionShape {
  id: string;
  name: string;
}

export default function HeatmapPage() {
  return (
    <FeatureGate module="machines" subFeature="production_utilisation_dashboard" as="h1">
      <Inner />
    </FeatureGate>
  );
}

function Inner() {
  const t = useTranslations('dashboard-production-utilisation');
  const { currentWorkspaceId } = useWorkspaceStore();

  const [month, setMonth] = useState<string>(dayjs().format('YYYY-MM'));
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [locationOptions, setLocationOptions] = useState<OptionShape[]>([]);
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    http
      .get(ApiEndpoints.locations.list(currentWorkspaceId))
      .then(unwrap<unknown>)
      .then((raw) => {
        if (cancelled) return;
        const arr = Array.isArray(raw)
          ? raw
          : ((raw as { items?: unknown[]; data?: unknown[] })?.items ??
            (raw as { data?: unknown[] })?.data ??
            []);
        const opts = (arr as Array<{ _id?: string; id?: string; name?: string }>)
          .map((x) => ({ id: String(x._id ?? x.id ?? ''), name: String(x.name ?? '-') }))
          .filter((x) => x.id);
        setLocationOptions(opts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !locationId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const res = await utilisationApi.getHeatmap(currentWorkspaceId, locationId, month);
      startTransition(() => {
        setData(res);
      });
    } catch {
      startTransition(() => {
        setError(t('errors.GENERIC'));
      });
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, locationId, month, t]);

  useEffect(() => {
    if (locationId) load();
  }, [locationId, month, load]);

  if (!currentWorkspaceId) return null;

  return (
    <div
      className="flex flex-col gap-5"
      style={{ padding: 24, background: 'var(--cr-bg)', margin: -24, minHeight: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
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
            {t('heatmap.title')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
              {t('heatmap.monthLabel')}
            </label>
            <DatePicker
              picker="month"
              value={dayjs(month, 'YYYY-MM') as Dayjs}
              onChange={(v) => v && setMonth(v.format('YYYY-MM'))}
              allowClear={false}
            />
          </div>
          <div style={{ minWidth: 220 }}>
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
              {t('heatmap.locationLabel')}
            </label>
            <Select
              placeholder={t('filter.allLocations')}
              value={locationId}
              onChange={setLocationId}
              options={locationOptions.map((o) => ({ label: o.name, value: o.id }))}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
        </div>
      </div>

      {!locationId ? (
        <DsCard>
          <Alert type="info" title={t('heatmap.selectLocationPrompt')} showIcon />
        </DsCard>
      ) : error ? (
        <Alert type="error" title={error} showIcon />
      ) : loading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : data && data.machines.length > 0 ? (
        <HeatmapGrid data={data} />
      ) : (
        <DsCard>
          <Alert type="info" title={t('empty.title')} description={t('empty.cta')} showIcon />
        </DsCard>
      )}
    </div>
  );
}
