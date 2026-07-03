'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Select, Spin, message } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import { DsTable } from '@/components/ui/DsTable';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { env } from '@/lib/env';

const BACKEND_URL = env.backendApiUrl;

function getCurrentFY(): string {
  const now = dayjs();
  const year = now.month() >= 3 ? now.year() : now.year() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

function getDefaultQuarter(): string {
  const now = dayjs();
  const month = now.month(); // 0-indexed
  // Q1: Apr-Jun (3-5), Q2: Jul-Sep (6-8), Q3: Oct-Dec (9-11), Q4: Jan-Mar (0-2)
  if (month >= 3 && month <= 5) return 'Q4'; // Most recent completed
  if (month >= 6 && month <= 8) return 'Q1';
  if (month >= 9 && month <= 11) return 'Q2';
  return 'Q3'; // Jan-Mar → Q3 of previous half
}

function buildPeriod(quarter: string, fy: string): string {
  return `${quarter}-${fy}`;
}

// i18n note: option/column labels resolve via the finance.gst.itc04 namespace, so these
// are factories taking the translator. FY values are still computed locally (date-derived).
type TFn = ReturnType<typeof useTranslations>;

const FY_OPTIONS = (t: TFn) => {
  const opts = [];
  const now = dayjs();
  const startYear = now.month() >= 3 ? now.year() : now.year() - 1;
  for (let i = 0; i < 3; i++) {
    const y = startYear - i;
    const range = `${y}-${String(y + 1).slice(2)}`;
    opts.push({
      value: range,
      label: t('itc04.fyOption', { range }),
    });
  }
  return opts;
};

const QUARTER_OPTIONS = (t: TFn) => [
  { value: 'Q1', label: t('itc04.quarter.q1') },
  { value: 'Q2', label: t('itc04.quarter.q2') },
  { value: 'Q3', label: t('itc04.quarter.q3') },
  { value: 'Q4', label: t('itc04.quarter.q4') },
];

const TABLE_4A_COLUMNS = (t: TFn) => [
  { title: t('itc04.col.slNo'), dataIndex: 'slNo', key: 'slNo', width: 60 },
  {
    title: t('itc04.col.jobWorkerGstin'),
    dataIndex: 'jobWorkerGstin',
    key: 'jobWorkerGstin',
    width: 160,
  },
  { title: t('itc04.col.description'), dataIndex: 'description', key: 'description', width: 200 },
  { title: t('itc04.col.hsn'), dataIndex: 'hsn', key: 'hsn', width: 90 },
  {
    title: t('itc04.col.qtySent'),
    dataIndex: 'qtySent',
    key: 'qtySent',
    width: 100,
    align: 'right' as const,
  },
  { title: t('itc04.col.unit'), dataIndex: 'unit', key: 'unit', width: 80 },
  { title: t('itc04.col.challanNo'), dataIndex: 'challanNo', key: 'challanNo', width: 130 },
  { title: t('itc04.col.challanDate'), dataIndex: 'challanDate', key: 'challanDate', width: 100 },
  {
    title: t('itc04.col.taxableValue'),
    dataIndex: 'taxableValue',
    key: 'taxableValue',
    width: 130,
    align: 'right' as const,
  },
];

const TABLE_4B_COLUMNS = (t: TFn) => [
  { title: t('itc04.col.slNo'), dataIndex: 'slNo', key: 'slNo', width: 60 },
  {
    title: t('itc04.col.jobWorkerGstin'),
    dataIndex: 'jobWorkerGstin',
    key: 'jobWorkerGstin',
    width: 160,
  },
  { title: t('itc04.col.description'), dataIndex: 'description', key: 'description', width: 200 },
  { title: t('itc04.col.hsn'), dataIndex: 'hsn', key: 'hsn', width: 90 },
  {
    title: t('itc04.col.qtyReceived'),
    dataIndex: 'qtyReceived',
    key: 'qtyReceived',
    width: 100,
    align: 'right' as const,
  },
  { title: t('itc04.col.unit'), dataIndex: 'unit', key: 'unit', width: 80 },
  { title: t('itc04.col.challanNo'), dataIndex: 'challanNo', key: 'challanNo', width: 130 },
  { title: t('itc04.col.challanDate'), dataIndex: 'challanDate', key: 'challanDate', width: 100 },
  {
    title: t('itc04.col.taxableValue'),
    dataIndex: 'taxableValue',
    key: 'taxableValue',
    width: 130,
    align: 'right' as const,
  },
];

interface Itc04Data {
  table4A: any[];
  table4B: any[];
}

export default function Itc04Page() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.itc04.* (and shared finance.gst.common.*).
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  // Persist the FY + quarter primary filters per firm so the picker survives navigation/reload.
  const [fy, setFy] = usePersistedState<string>(`finance:gst:itc04:fy:${firmId}`, getCurrentFY());
  const [quarter, setQuarter] = usePersistedState<string>(
    `finance:gst:itc04:quarter:${firmId}`,
    getDefaultQuarter(),
  );
  const [data, setData] = useState<Itc04Data | null>(null);
  const [loading, setLoading] = useState(false);
  // Error/retry pair: a failed fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const period = buildPeriod(quarter, fy);

  const loadData = useCallback(async () => {
    if (!wsId || !firmId || gstAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/workspaces/${wsId}/firms/${firmId}/itc04?period=${encodeURIComponent(period)}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload = json?.data ?? json;
      startTransition(() => {
        setData({
          table4A: payload?.table4A ?? [],
          table4B: payload?.table4B ?? [],
        });
      });
    } catch {
      message.error(t('itc04.loadError'));
      startTransition(() => {
        setData(null);
        setError(true);
      });
    } finally {
      setLoading(false);
    }
  }, [wsId, firmId, period]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadKey]);

  function handleExportJson() {
    const url = `${BACKEND_URL}/api/workspaces/${wsId}/firms/${firmId}/itc04/export?period=${encodeURIComponent(period)}`;
    window.open(url, '_self');
  }

  const emptyState = (
    <div className="p-xl text-center" style={{ color: 'var(--cr-text-3)' }}>
      <p>{t('itc04.empty.noActivity', { quarter, fy })}</p>
      <p className="text-[12px]">{t('itc04.empty.hint')}</p>
    </div>
  );

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
        title={t('itc04.title')}
        icon={<FileProtectOutlined />}
        titleAside={<InfoTooltip text={t('itc04.info')} />}
        right={
          <div className="flex items-center gap-sm">
            <Select
              aria-label={t('common.selectFy')}
              value={fy}
              onChange={setFy}
              options={FY_OPTIONS(t)}
              style={{ width: 130 }}
              placeholder={t('itc04.selectFyPlaceholder')}
            />
            <Select
              aria-label={t('common.selectQuarter')}
              value={quarter}
              onChange={setQuarter}
              options={QUARTER_OPTIONS(t)}
              style={{ width: 150 }}
              placeholder={t('itc04.selectQuarterPlaceholder')}
            />
            <DsButton dsVariant="ghost" onClick={loadData}>
              {t('common.reload')}
            </DsButton>
            <DsButton dsVariant="primary" onClick={handleExportJson}>
              {t('itc04.exportGstnJson')}
            </DsButton>
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
      ) : loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
          <Spin tip={t('itc04.loading')} size="large" />
        </div>
      ) : !data ? (
        emptyState
      ) : (
        <>
          {/* Table 4A */}
          <div className="mb-xl">
            <h3
              className="mb-sm text-[14px] font-bold"
              style={{
                background: 'var(--cr-surface-2)',
                padding: '8px 16px',
                borderRadius: '6px 6px 0 0',
                border: '1px solid var(--cr-border)',
                borderBottom: 'none',
                color: 'var(--cr-text)',
                margin: 0,
              }}
            >
              {t('itc04.table4aTitle')}
            </h3>
            {data.table4A.length === 0 ? (
              <div
                className="p-lg text-center"
                style={{
                  border: '1px solid var(--cr-border)',
                  borderRadius: '0 0 6px 6px',
                  color: 'var(--cr-text-3)',
                  background: 'var(--cr-surface)',
                }}
              >
                {t('itc04.empty.noSent', { quarter, fy })}
              </div>
            ) : (
              <DsTable
                dataSource={data.table4A.map((row: any, i: number) => ({
                  ...row,
                  slNo: i + 1,
                  key: row._id ?? i,
                }))}
                columns={TABLE_4A_COLUMNS(t)}
                pagination={false}
                scrollX="max-content"
                size="small"
                style={{ borderRadius: '0 0 6px 6px' }}
              />
            )}
          </div>

          {/* Table 4B */}
          <div className="mb-xl">
            <h3
              className="mb-sm text-[14px] font-bold"
              style={{
                background: 'var(--cr-surface-2)',
                padding: '8px 16px',
                borderRadius: '6px 6px 0 0',
                border: '1px solid var(--cr-border)',
                borderBottom: 'none',
                color: 'var(--cr-text)',
                margin: 0,
              }}
            >
              {t('itc04.table4bTitle')}
            </h3>
            {data.table4B.length === 0 ? (
              <div
                className="p-lg text-center"
                style={{
                  border: '1px solid var(--cr-border)',
                  borderRadius: '0 0 6px 6px',
                  color: 'var(--cr-text-3)',
                  background: 'var(--cr-surface)',
                }}
              >
                {t('itc04.empty.noReceived', { quarter, fy })}
              </div>
            ) : (
              <DsTable
                dataSource={data.table4B.map((row: any, i: number) => ({
                  ...row,
                  slNo: i + 1,
                  key: row._id ?? i,
                }))}
                columns={TABLE_4B_COLUMNS(t)}
                pagination={false}
                scrollX="max-content"
                size="small"
                style={{ borderRadius: '0 0 6px 6px' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
