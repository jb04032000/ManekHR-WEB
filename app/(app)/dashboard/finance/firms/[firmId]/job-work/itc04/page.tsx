'use client';
// Finance polish (job-work): i18n via finance.jobWork.itc04; DsPageHeader title + InfoTooltip
// explaining ITC-04. Quarter/FY logic unchanged. No data logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Select, Segmented, Tooltip, Skeleton, Spin, message, Empty } from 'antd';
import {
  DownloadOutlined,
  PrinterOutlined,
  LoadingOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { getItc04Report, getItc04Export } from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import Itc04Tables from '@/components/finance/job-work/Itc04Tables';
import type { Itc04Report, Party } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

// Compute current financial year (India FY: Apr-Mar)
function getCurrentFy(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  if (month >= 4) {
    // e.g. April 2026 → FY 2026-27 → "2627"
    return `${String(year).slice(2)}${String(year + 1).slice(2)}`;
  }
  // e.g. Jan 2026 → FY 2025-26 → "2526"
  return `${String(year - 1).slice(2)}${String(year).slice(2)}`;
}

function getFyOptions(): { value: string; label: string }[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentStartYear = month >= 4 ? year : year - 1;
  return [0, 1, 2].map((offset) => {
    const y = currentStartYear - offset;
    const code = `${String(y).slice(2)}${String(y + 1).slice(2)}`;
    return { value: code, label: `${y}–${String(y + 1).slice(2)}` };
  });
}

export default function Itc04Page() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const t = useTranslations('finance.jobWork');
  const tShared = useTranslations('finance.sales'); // shared listCommon.error* labels for the retry panel
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [quarter, setQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [fy, setFy] = useState<string>(getCurrentFy());
  const [partyId, setPartyId] = useState<string | undefined>();
  const [parties, setParties] = useState<Party[]>([]);

  const [report, setReport] = useState<Itc04Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false); // distinguishes a failed report fetch from a genuinely empty quarter
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [exporting, setExporting] = useState(false);

  // Load parties for filter
  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    listParties(wsId, firmId, { pageSize: 100 })
      .then((res) => setParties(res.items ?? []))
      .catch(() => {});
  }, [wsId, firmId, jobWorkAccess.isLocked]);

  // Load report when filters change
  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
      setReport(null);
    });
    getItc04Report(wsId, firmId, { quarter, fy, partyId })
      .then(setReport)
      .catch(() => {
        setReport(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, firmId, quarter, fy, partyId, reloadKey, jobWorkAccess.isLocked]);

  // Export ITC-04 JSON
  async function handleExport() {
    setExporting(true);
    try {
      const data = await getItc04Export(wsId, firmId, { quarter, fy });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const gstin = data.gstin ?? firmId;
      a.href = url;
      a.download = `ITC-04-${quarter}-FY${fy}-${gstin}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(t('itc04.exportSuccess', { quarter, fy }), 4.5);
    } catch {
      message.error(t('itc04.exportFailed'), 6);
    } finally {
      setExporting(false);
    }
  }

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

  const fyOptions = getFyOptions();

  return (
    <div className="p-6">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <DsPageHeader
          title={t('itc04.title')}
          icon={<FileDoneOutlined />}
          titleAside={<InfoTooltip text={t('itc04.tip')} />}
          style={{ marginBottom: 16 }}
        />

        {/* Filter controls */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: '12px 16px',
            border: '1px solid var(--cr-border)',
          }}
        >
          <Segmented
            value={quarter}
            onChange={(v) => setQuarter(v as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
            options={[
              { value: 'Q1', label: t('itc04.q1') },
              { value: 'Q2', label: t('itc04.q2') },
              { value: 'Q3', label: t('itc04.q3') },
              { value: 'Q4', label: t('itc04.q4') },
            ]}
          />
          <Select value={fy} onChange={setFy} style={{ minWidth: 120 }} options={fyOptions} />
          <Select
            aria-label={t('itc04.filterPrincipalAria')}
            allowClear
            placeholder={t('itc04.allPrincipals')}
            style={{ minWidth: 200 }}
            value={partyId}
            onChange={setPartyId}
            options={parties.map((p) => ({ value: p._id, label: p.name }))}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Tooltip title={t('itc04.exportTooltip')}>
              <Button
                icon={exporting ? <LoadingOutlined /> : <DownloadOutlined />}
                loading={exporting}
                onClick={handleExport}
                disabled={loading}
              >
                {t('itc04.exportJson')}
              </Button>
            </Tooltip>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={loading}>
              {t('itc04.printForCa')}
            </Button>
          </div>
        </div>
      </div>

      {/* Tables */}
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : loading ? (
        <div>
          <Skeleton active paragraph={{ rows: 6 }} />
          <div style={{ marginTop: 24 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        </div>
      ) : report ? (
        <div
          style={{
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: 24,
            border: '1px solid var(--cr-border)',
          }}
        >
          <Itc04Tables report={report} />

          {/* Footer note */}
          <div
            style={{
              marginTop: 24,
              padding: '12px 16px',
              background: 'var(--cr-surface-2)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--cr-text-3)',
              fontStyle: 'italic',
            }}
          >
            {t('itc04.footerNote')}
          </div>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>
                {t('itc04.noData', { quarter, fy })}
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
