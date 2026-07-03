'use client';

/**
 * Phase 25 / Plan 25-12 - Production Utilisation Dashboard (index page).
 *
 * Renders the global filter bar, six KPI cards, an export button (F-14
 * pipeline), and standard empty/loading/error states. Page-level subscription
 * gate via FeatureGate - workspaces without entitlement see an upgrade
 * prompt rather than 404.
 */
import { useEffect, useMemo, useState, useCallback, startTransition } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import http from '@/lib/api/client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/client';
import { utilisationApi } from '@/lib/api/modules/utilisation.api';
import { ExportButton } from '@/components/export/ExportButton';
import { UTILISATION_EXPORT_FIELDS } from '@/lib/exportFields/utilisationFields';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import KpiCardsRow from '@/components/utilisation/KpiCardsRow';
import GlobalFilterBar from '@/components/utilisation/GlobalFilterBar';
import type { KpiResponse, UtilisationFilterQuery } from '@/types';

interface OptionShape {
  id: string;
  name: string;
}

export default function ProductionUtilisationPage() {
  return (
    <FeatureGate module="machines" subFeature="production_utilisation_dashboard" as="h1">
      <Inner />
    </FeatureGate>
  );
}

function Inner() {
  const t = useTranslations('dashboard-production-utilisation');
  const { currentWorkspaceId } = useWorkspaceStore();

  const [filters, setFilters] = useState<UtilisationFilterQuery>({});
  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [machineOptions, setMachineOptions] = useState<OptionShape[]>([]);
  const [locationOptions, setLocationOptions] = useState<OptionShape[]>([]);
  const [shiftOptions, setShiftOptions] = useState<OptionShape[]>([]);

  // Load filter option catalogues once per workspace
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    Promise.allSettled([
      http.get(ApiEndpoints.machines.list(currentWorkspaceId)).then(unwrap<unknown>),
      http.get(ApiEndpoints.locations.list(currentWorkspaceId)).then(unwrap<unknown>),
      http.get(ApiEndpoints.shifts.list(currentWorkspaceId)).then(unwrap<unknown>),
    ]).then(([m, l, s]) => {
      if (cancelled) return;
      const toOpts = (raw: unknown): OptionShape[] => {
        const arr = Array.isArray(raw)
          ? raw
          : ((raw as { items?: unknown[]; data?: unknown[] })?.items ??
            (raw as { data?: unknown[] })?.data ??
            []);
        return (arr as Array<{ _id?: string; id?: string; name?: string; title?: string }>)
          .map((x) => ({
            id: String(x._id ?? x.id ?? ''),
            name: String(x.name ?? x.title ?? '-'),
          }))
          .filter((x) => x.id);
      };
      if (m.status === 'fulfilled') setMachineOptions(toOpts(m.value));
      if (l.status === 'fulfilled') setLocationOptions(toOpts(l.value));
      if (s.status === 'fulfilled') setShiftOptions(toOpts(s.value));
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  const loadKpis = useCallback(
    async (q: UtilisationFilterQuery) => {
      if (!currentWorkspaceId) return;
      startTransition(() => {
        setLoading(true);
        setError(null);
      });
      try {
        const res = await utilisationApi.getKpis(currentWorkspaceId, q);
        startTransition(() => {
          setKpis(res);
        });
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response
            ?.data?.error?.message ?? t('errors.GENERIC');
        // Map known backend codes to localized messages
        const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data
          ?.error?.code;
        startTransition(() => {
          if (code === 'RANGE_TOO_LARGE') setError(t('errors.RANGE_TOO_LARGE'));
          else if (code === 'TOO_MANY_MACHINES') setError(t('errors.TOO_MANY_MACHINES'));
          else if (code === 'INVALID_MACHINE_ID') setError(t('errors.INVALID_MACHINE_ID'));
          else if (code === 'MACHINE_OUT_OF_SCOPE') setError(t('errors.MACHINE_OUT_OF_SCOPE'));
          else setError(msg);
        });
      } finally {
        setLoading(false);
      }
    },
    [currentWorkspaceId, t],
  );

  useEffect(() => {
    if (!currentWorkspaceId) return;
    loadKpis(filters);
  }, [filters, currentWorkspaceId, loadKpis]);

  const exportFilename = useMemo(() => `utilisation_${dayjs().format('YYYY-MM-DD')}`, []);

  if (!currentWorkspaceId) {
    return null;
  }

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
          flexWrap: 'wrap',
          gap: 12,
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
            {t('page.subtitle')}
          </p>
        </div>
        <ExportButton
          fields={UTILISATION_EXPORT_FIELDS}
          getExportData={() =>
            utilisationApi.getExportRows(currentWorkspaceId, { ...filters, format: 'raw' })
          }
          title={t('export.modalTitle')}
          filename={exportFilename}
          module="machines"
          _forceServerModeFetch
        />
      </div>

      <GlobalFilterBar
        value={filters}
        onChange={setFilters}
        machineOptions={machineOptions}
        locationOptions={locationOptions}
        shiftOptions={shiftOptions}
      />

      {error ? (
        <Alert
          type="error"
          title={error}
          showIcon
          action={
            <a onClick={() => loadKpis(filters)} style={{ cursor: 'pointer' }}>
              {t('page.refresh')}
            </a>
          }
        />
      ) : loading && !kpis ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : kpis &&
        kpis.todayOutput.stitches === 0 &&
        kpis.todayOutput.pieces === 0 &&
        kpis.todayOutput.hours === 0 &&
        kpis.weekOutput.stitches === 0 &&
        kpis.weekOutput.pieces === 0 &&
        kpis.weekOutput.hours === 0 &&
        kpis.monthOutput.stitches === 0 &&
        kpis.monthOutput.pieces === 0 &&
        kpis.monthOutput.hours === 0 ? (
        <Alert type="info" title={t('empty.title')} description={t('empty.cta')} showIcon />
      ) : (
        <KpiCardsRow data={kpis} loading={loading} />
      )}
    </div>
  );
}
