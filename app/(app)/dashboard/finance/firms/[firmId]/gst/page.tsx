'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DatePicker, Statistic, Spin } from 'antd';
import {
  ArrowRightOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  QrcodeOutlined,
  CarOutlined,
  ScanOutlined,
  FileProtectOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import {
  listPendingEInvoices,
  getVerifyDataResults,
  listExpiringEwbs,
} from '@/lib/actions/finance/gst.actions';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { EInvoicePending, VerifyDataResult } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

interface KpiState<T> {
  data: T | null;
  loading: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function getDaysUntilQuarterEnd(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Quarter ends: March (2), June (5), September (8), December (11)
  const quarterEnds = [2, 5, 8, 11];
  const nextQEnd = quarterEnds.find((m) => m >= month) ?? 11;
  const endDate = new Date(now.getFullYear(), nextQEnd + 1, 0); // last day of quarter-end month
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function irnBacklogColor(count: number): string {
  if (count === 0) return 'var(--cr-success)';
  if (count <= 5) return 'var(--cr-warning)';
  return 'var(--cr-error)';
}

export default function GstHubPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: user-facing copy via the finance.gst namespace (hub block).
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const period = selectedMonth.format('MMYYYY');

  const [pendingIrn, setPendingIrn] = useState<KpiState<EInvoicePending[]>>({
    data: null,
    loading: true,
  });
  const [verifyData, setVerifyData] = useState<KpiState<VerifyDataResult[]>>({
    data: null,
    loading: true,
  });
  const [expiringEwbs, setExpiringEwbs] = useState<KpiState<any[]>>({ data: null, loading: true });
  // Error/retry pair: any failed KPI fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const daysUntilQuarterEnd = getDaysUntilQuarterEnd();

  const loadKpis = useCallback(async () => {
    if (!wsId || !firmId || gstAccess.isLocked) return;

    // Load IRN backlog
    startTransition(() => {
      setPendingIrn({ data: null, loading: true });
      setError(false);
    });
    listPendingEInvoices(wsId, firmId)
      .then((data) => setPendingIrn({ data, loading: false }))
      .catch(() => {
        setPendingIrn({ data: [], loading: false });
        setError(true);
      });

    // Load Verify-My-Data latest result
    startTransition(() => {
      setVerifyData({ data: null, loading: true });
    });
    getVerifyDataResults(wsId, firmId, period)
      .then((data) => setVerifyData({ data, loading: false }))
      .catch(() => {
        setVerifyData({ data: [], loading: false });
        setError(true);
      });

    // Load expiring EWBs
    startTransition(() => {
      setExpiringEwbs({ data: null, loading: true });
    });
    listExpiringEwbs(wsId, firmId, 48)
      .then((data) => setExpiringEwbs({ data, loading: false }))
      .catch(() => {
        setExpiringEwbs({ data: [], loading: false });
        setError(true);
      });
  }, [wsId, firmId, period, gstAccess.isLocked]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis, reloadKey]);

  const basePath = `/dashboard/finance/firms/${firmId}/gst`;

  const irnCount = pendingIrn.data?.length ?? 0;
  const latestScan = verifyData.data?.[0] ?? null;
  const ewbCount = expiringEwbs.data?.length ?? 0;

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
    <div className="p-lg">
      <DsPageHeader
        title={t('hub.title')}
        icon={<FileDoneOutlined />}
        titleAside={<InfoTooltip text={t('hub.info')} />}
        right={
          <div className="flex items-center gap-sm">
            <span className="text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
              {t('common.period')}
            </span>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(val) => val && setSelectedMonth(val)}
              format="MMM YYYY"
              allowClear={false}
              style={{ width: 130 }}
            />
          </div>
        }
      />

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <>
          {/* KPI Cards - 3×2 grid */}
          <div className="mb-xl grid grid-cols-2 gap-md lg:grid-cols-3">
            {/* IRN Backlog */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              {pendingIrn.loading ? (
                <div className="flex h-full min-h-[80px] items-center justify-center">
                  <Spin size="small" />
                </div>
              ) : (
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[12px] font-bold tracking-wide uppercase"
                      style={{ color: 'var(--cr-text-3)' }}
                    >
                      {t('hub.kpi.irnBacklog')}
                    </span>
                    <Link href={`${basePath}/einvoice`}>
                      <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                    </Link>
                  </div>
                  <Statistic
                    value={irnCount}
                    styles={{
                      content: {
                        fontSize: 28,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        color: irnBacklogColor(irnCount),
                      },
                    }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                    {t('hub.kpi.irnBacklogSub')}
                  </span>
                </div>
              )}
            </div>

            {/* GSTR-1 Status */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              <div className="flex flex-col gap-xs">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[12px] font-bold tracking-wide uppercase"
                    style={{ color: 'var(--cr-text-3)' }}
                  >
                    {t('hub.kpi.gstr1Status')}
                  </span>
                  <Link href={`${basePath}/gstr1`}>
                    <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                  </Link>
                </div>
                <span
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-warning)' }}
                >
                  {t('hub.kpi.notFiled')}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                  {selectedMonth.format('MMM YYYY')}
                </span>
              </div>
            </div>

            {/* GSTR-3B Status */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              <div className="flex flex-col gap-xs">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[12px] font-bold tracking-wide uppercase"
                    style={{ color: 'var(--cr-text-3)' }}
                  >
                    {t('hub.kpi.gstr3bStatus')}
                  </span>
                  <Link href={`${basePath}/gstr3b`}>
                    <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                  </Link>
                </div>
                <span
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-warning)' }}
                >
                  {t('hub.kpi.notFiled')}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                  {selectedMonth.format('MMM YYYY')}
                </span>
              </div>
            </div>

            {/* Verify-My-Data */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              {verifyData.loading ? (
                <div className="flex h-full min-h-[80px] items-center justify-center">
                  <Spin size="small" />
                </div>
              ) : (
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[12px] font-bold tracking-wide uppercase"
                      style={{ color: 'var(--cr-text-3)' }}
                    >
                      {t('hub.kpi.verifyData')}
                    </span>
                    <Link href={`${basePath}/verify`}>
                      <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                    </Link>
                  </div>
                  {latestScan ? (
                    <>
                      <span
                        className="text-[16px] font-bold"
                        style={{
                          fontFamily: 'var(--font-display)',
                          color:
                            latestScan.errorCount > 0
                              ? 'var(--cr-error)'
                              : latestScan.warningCount > 0
                                ? 'var(--cr-warning)'
                                : 'var(--cr-success)',
                        }}
                      >
                        {t('hub.kpi.verifySummary', {
                          errors: latestScan.errorCount,
                          warnings: latestScan.warningCount,
                        })}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                        {t('hub.kpi.lastScanned', {
                          time: formatRelativeTime(latestScan.scannedAt),
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="text-[16px] font-bold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-text-4)' }}
                      >
                        {t('hub.kpi.neverScanned')}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                        {t('hub.kpi.forThisPeriod')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* EWB Expiring */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              {expiringEwbs.loading ? (
                <div className="flex h-full min-h-[80px] items-center justify-center">
                  <Spin size="small" />
                </div>
              ) : (
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[12px] font-bold tracking-wide uppercase"
                      style={{ color: 'var(--cr-text-3)' }}
                    >
                      {t('hub.kpi.ewbExpiring')}
                    </span>
                    <Link href={`${basePath}/ewaybill`}>
                      <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                    </Link>
                  </div>
                  <Statistic
                    value={ewbCount}
                    styles={{
                      content: {
                        fontSize: 28,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        color: ewbCount > 0 ? 'var(--cr-warning)' : 'var(--cr-text-3)',
                      },
                    }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                    {t('hub.kpi.ewbExpiringSub')}
                  </span>
                </div>
              )}
            </div>

            {/* ITC-04 Due */}
            <div
              className="rounded-lg p-md"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                minHeight: 120,
              }}
            >
              <div className="flex flex-col gap-xs">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[12px] font-bold tracking-wide uppercase"
                    style={{ color: 'var(--cr-text-3)' }}
                  >
                    {t('hub.kpi.itc04Due')}
                  </span>
                  <Link href={`${basePath}/itc04`}>
                    <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--cr-primary)' }} />
                  </Link>
                </div>
                <span
                  className="text-[20px] font-bold"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: daysUntilQuarterEnd <= 7 ? 'var(--cr-warning)' : 'var(--cr-text-3)',
                  }}
                >
                  {daysUntilQuarterEnd === 0
                    ? t('hub.kpi.dueToday')
                    : t('hub.kpi.dueInDays', { days: daysUntilQuarterEnd })}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                  {t('hub.kpi.currentQuarter')}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick-links bar */}
      <div className="flex flex-wrap gap-sm">
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/gstr1`)}>
          <FileDoneOutlined style={{ marginRight: 4 }} />
          {t('hub.links.gstr1')}
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/gstr3b`)}>
          <FileTextOutlined style={{ marginRight: 4 }} />
          {t('hub.links.gstr3b')}
        </DsButton>
        {/* GSTR-2B reconciliation: match purchase bills vs portal 2B to protect ITC. */}
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/gstr2b`)}>
          <SafetyOutlined style={{ marginRight: 4 }} />
          {t('hub.links.gstr2b')}
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/einvoice`)}>
          <QrcodeOutlined style={{ marginRight: 4 }} />
          {t('hub.links.einvoice')}
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/ewaybill`)}>
          <CarOutlined style={{ marginRight: 4 }} />
          {t('hub.links.ewaybill')}
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/verify`)}>
          <ScanOutlined style={{ marginRight: 4 }} />
          {t('hub.links.verify')}
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${basePath}/itc04`)}>
          <FileProtectOutlined style={{ marginRight: 4 }} />
          {t('hub.links.itc04')}
        </DsButton>
      </div>
    </div>
  );
}
