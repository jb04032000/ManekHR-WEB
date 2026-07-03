'use client';

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Progress, Select, Spin, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, ScanOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { DsTag } from '@/components/ui/DsBadge';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { getVerifyDataResults, runVerifyDataScan } from '@/lib/actions/finance/gst.actions';
import type { ColumnsType } from 'antd/es/table';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

// ── category metadata ─────────────────────────────────────────────────────────
// i18n note: option + label maps resolve via the finance.gst.verify.category namespace.
// Cross-link: keys c01..c11 (full labels) and c01opt..c11opt (filter options).
type TFn = ReturnType<typeof useTranslations>;

const CATEGORY_OPTIONS = (t: TFn) => [
  { value: 'all', label: t('verify.category.all') },
  { value: 'C-01', label: t('verify.category.c01opt') },
  { value: 'C-02', label: t('verify.category.c02opt') },
  { value: 'C-03', label: t('verify.category.c03opt') },
  { value: 'C-04', label: t('verify.category.c04opt') },
  { value: 'C-05', label: t('verify.category.c05opt') },
  { value: 'C-06', label: t('verify.category.c06opt') },
  { value: 'C-07', label: t('verify.category.c07opt') },
  { value: 'C-08', label: t('verify.category.c08opt') },
  { value: 'C-09', label: t('verify.category.c09opt') },
  { value: 'C-10', label: t('verify.category.c10opt') },
  { value: 'C-11', label: t('verify.category.c11opt') },
];

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  'C-01': 'verify.category.c01',
  'C-02': 'verify.category.c02',
  'C-03': 'verify.category.c03',
  'C-04': 'verify.category.c04',
  'C-05': 'verify.category.c05',
  'C-06': 'verify.category.c06',
  'C-07': 'verify.category.c07',
  'C-08': 'verify.category.c08',
  'C-09': 'verify.category.c09',
  'C-10': 'verify.category.c10',
  'C-11': 'verify.category.c11',
};

function extractCategory(checkId: string): string {
  const match = checkId?.match(/^(C-\d+)/i);
  return match ? match[1].toUpperCase() : checkId;
}

function getCategoryLabel(checkId: string, t: TFn): string {
  const cat = extractCategory(checkId);
  const key = CATEGORY_LABEL_KEYS[cat];
  return key ? t(key) : cat;
}

function formatRelativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ── component ──────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ firmId: string }>;
}

export default function VerifyDataPage({ params }: PageProps) {
  const [firmId, setFirmId] = useState('');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.verify.*.
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  // Period (default = current month MMYYYY)
  const now = new Date();
  const defaultPeriod = `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
  const [period] = useState(defaultPeriod);

  // Error/retry pair: a failed results fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [findings, setFindings] = useState<any[]>([]);
  const [lastScan, setLastScan] = useState<{
    scannedAt: string;
    errorCount: number;
    warningCount: number;
  } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Filters - persisted per firm so the severity + category selection survives navigation/reload.
  const [severityFilter, setSeverityFilter] = usePersistedState<'all' | 'error' | 'warning'>(
    `finance:gst:verify:severity:${firmId}`,
    'all',
  );
  const [categoryFilter, setCategoryFilter] = usePersistedState<string>(
    `finance:gst:verify:category:${firmId}`,
    'all',
  );

  useEffect(() => {
    params.then((p) => setFirmId(p.firmId));
  }, [params]);

  const loadResults = useCallback(async () => {
    if (!wsId || !firmId || gstAccess.isLocked) return;
    startTransition(() => {
      setLoadingResults(true);
      setError(false);
    });
    try {
      const results = await getVerifyDataResults(wsId, firmId, period);
      if (results && results.length > 0) {
        const latest = results[0];
        startTransition(() => {
          setFindings((latest as any).findings ?? []);
          setLastScan({
            scannedAt: (latest as any).scannedAt,
            errorCount: (latest as any).errorCount ?? 0,
            warningCount: (latest as any).warningCount ?? 0,
          });
        });
      } else {
        startTransition(() => {
          setFindings([]);
          setLastScan(null);
        });
      }
    } catch {
      startTransition(() => {
        setError(true);
        setFindings([]);
        setLastScan(null);
      });
    } finally {
      setLoadingResults(false);
    }
  }, [wsId, firmId, period]);

  useEffect(() => {
    if (wsId && firmId && !gstAccess.isLocked) loadResults();
  }, [wsId, firmId, loadResults, gstAccess.isLocked, reloadKey]);

  // ── Run Scan ─────────────────────────────────────────────────────────────────

  const handleRunScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);

    // Animate progress 0→95% over 3s (fake progress; real call is concurrent)
    let prog = 0;
    progressIntervalRef.current = setInterval(() => {
      prog += Math.random() * 8 + 4; // 4-12% steps
      if (prog >= 95) {
        prog = 95;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
      setScanProgress(Math.round(prog));
    }, 150);

    try {
      await runVerifyDataScan(wsId, firmId, period);
      // On complete: jump to 100% then hide
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setScanProgress(100);
      await loadResults();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('verify.scanFailedShort');
      message.error(t('verify.scanFailed', { msg }), 5);
    } finally {
      setTimeout(() => {
        setScanning(false);
        setScanProgress(0);
      }, 500);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    if (findings.length === 0) return;
    const header = ['Check', 'Severity', 'Category', 'Description', 'Document', 'Fix Route'];
    const rows = findings.map((f: any) => [
      extractCategory(f.checkId ?? ''),
      f.severity ?? '',
      getCategoryLabel(f.checkId ?? '', t),
      `"${(f.message ?? '').replace(/"/g, '""')}"`,
      f.affectedDocNo ?? '',
      f.fixRoute ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verify-data-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredFindings = findings.filter((f: any) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (categoryFilter !== 'all') {
      const cat = extractCategory(f.checkId ?? '');
      if (!cat.startsWith(categoryFilter)) return false;
    }
    return true;
  });

  const errorCount = findings.filter((f: any) => f.severity === 'error').length;
  const warningCount = findings.filter((f: any) => f.severity === 'warning').length;

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<any> = [
    {
      title: t('verify.col.check'),
      key: 'check',
      width: 70,
      render: (_: any, row: any) => (
        <span className="font-body text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
          {extractCategory(row.checkId ?? '')}
        </span>
      ),
    },
    {
      title: t('verify.col.severity'),
      key: 'severity',
      width: 90,
      render: (_: any, row: any) =>
        row.severity === 'error' ? (
          <DsTag status="error" label={t('verify.severity.error')} />
        ) : (
          <DsTag status="warning" label={t('verify.severity.warning')} />
        ),
    },
    {
      title: t('verify.col.category'),
      key: 'category',
      width: 160,
      render: (_: any, row: any) => getCategoryLabel(row.checkId ?? '', t),
    },
    {
      title: t('verify.col.description'),
      key: 'description',
      render: (_: any, row: any) => (
        <span
          className="font-body text-[14px] whitespace-normal"
          style={{ color: 'var(--cr-text-2)' }}
        >
          {row.message ?? '-'}
        </span>
      ),
    },
    {
      title: t('verify.col.document'),
      key: 'document',
      width: 140,
      render: (_: any, row: any) => row.affectedDocNo ?? '-',
    },
    {
      title: t('verify.col.fix'),
      key: 'fix',
      width: 60,
      render: (_: any, row: any) =>
        row.fixRoute ? (
          <Link href={row.fixRoute} style={{ color: 'var(--cr-primary)', fontSize: 13 }}>
            {t('verify.fix')}
          </Link>
        ) : (
          '-'
        ),
    },
  ];

  // Row left border based on severity
  const rowClassName = (record: any) =>
    record.severity === 'error' ? 'verify-error-row' : 'verify-warning-row';

  // ── Render ───────────────────────────────────────────────────────────────────

  if (gstAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (gstAccess.isLocked) {
    return <ModuleLockedPage module="gst_compliance" />;
  }

  return (
    <div
      className="flex flex-col gap-md p-lg"
      style={{ background: 'var(--cr-bg)', minHeight: '100vh' }}
    >
      <DsPageHeader
        title={t('verify.title')}
        icon={<ScanOutlined />}
        titleAside={<InfoTooltip text={t('verify.info')} />}
        sub={
          lastScan
            ? t('verify.lastScan', {
                time: formatRelativeTime(lastScan.scannedAt),
                errors: lastScan.errorCount,
                warnings: lastScan.warningCount,
              })
            : t('verify.neverScanned')
        }
        right={
          <div className="flex items-center gap-2">
            {findings.length > 0 && (
              <DsButton dsVariant="ghost" onClick={handleExportCsv} icon={<DownloadOutlined />}>
                {t('verify.exportCsv')}
              </DsButton>
            )}
            <DsButton
              dsVariant="primary"
              loading={scanning}
              onClick={handleRunScan}
              icon={<ScanOutlined />}
            >
              {scanning ? t('verify.scanning') : t('verify.runScan')}
            </DsButton>
          </div>
        }
      />

      {/* Scan progress bar */}
      {scanning && (
        <Progress
          percent={scanProgress}
          status="active"
          strokeColor="var(--cr-primary)"
          showInfo={false}
          style={{ marginBottom: 0 }}
        />
      )}

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        /* Filter bar */
        <div style={{ background: 'var(--cr-surface)', borderRadius: 8, padding: 16 }}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Severity tabs */}
            <div className="flex gap-2">
              {[
                { key: 'all', label: t('verify.filter.all', { count: findings.length }) },
                { key: 'error', label: t('verify.filter.errors', { count: errorCount }) },
                { key: 'warning', label: t('verify.filter.warnings', { count: warningCount }) },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSeverityFilter(tab.key as 'all' | 'error' | 'warning')}
                  className="rounded border px-3 py-1 font-body text-[13px]"
                  style={{
                    background:
                      severityFilter === tab.key ? 'var(--cr-primary)' : 'var(--cr-surface)',
                    color: severityFilter === tab.key ? '#fff' : 'var(--cr-text-2)',
                    borderColor:
                      severityFilter === tab.key ? 'var(--cr-primary)' : 'var(--cr-border)',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <Select
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              options={CATEGORY_OPTIONS(t)}
              style={{ width: 220 }}
              size="middle"
              aria-label={t('verify.col.category')}
            />
          </div>

          {/* Findings table or empty state */}
          {!loadingResults &&
          filteredFindings.length === 0 &&
          findings.length === 0 &&
          !scanning ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <CheckCircleOutlined style={{ fontSize: 48, color: 'var(--cr-success)' }} />
              <div className="text-center">
                <p
                  className="font-display text-[20px] font-bold"
                  style={{ color: 'var(--cr-text)' }}
                >
                  {lastScan ? t('verify.empty.cleanTitle') : t('verify.empty.firstTitle')}
                </p>
                <p
                  className="mt-1 font-body text-[14px]"
                  style={{ color: 'var(--cr-text-2)', maxWidth: 400 }}
                >
                  {lastScan ? t('verify.empty.cleanBody') : t('verify.empty.firstBody')}
                </p>
              </div>
              {lastScan && (
                <Link href={`/dashboard/finance/firms/${firmId}/gst/gstr1`}>
                  <DsButton dsVariant="primary">{t('verify.empty.exportGstr1')}</DsButton>
                </Link>
              )}
            </div>
          ) : (
            <DsTable
              columns={columns}
              dataSource={filteredFindings}
              rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
              loading={loadingResults || scanning}
              scrollX="max-content"
              rowClassName={rowClassName}
              pagination={{
                pageSize: 50,
                showSizeChanger: false,
                showTotal: (t) => `${t} records`,
              }}
            />
          )}
        </div>
      )}

      {/* Row border styles */}
      <style jsx>{`
        :global(.verify-error-row td:first-child) {
          border-left: 3px solid var(--cr-error);
        }
        :global(.verify-warning-row td:first-child) {
          border-left: 3px solid var(--cr-warning);
        }
      `}</style>
    </div>
  );
}
