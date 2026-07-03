'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  Tabs,
  Alert,
  Collapse,
  Skeleton,
  Spin,
  Tooltip,
  Tag,
  Badge,
  message,
} from 'antd';
import { FileDoneOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { getGstr1Report, validateGstr1, exportGstr1Json } from '@/lib/actions/finance/gst.actions';
import DsButton from '@/components/ui/DsButton';
import { DsTable } from '@/components/ui/DsTable';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { Gstr1Report, VerifyDataFinding } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

function formatINR(paise: number): string {
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '8px 12px' }}>
              <Skeleton.Button active size="small" style={{ width: '80%', height: 14 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Section columns ──────────────────────────────────────────────────────────
// Column factories take the finance.gst translator so header labels are i18n-driven.
// Cross-link: keys live under finance.gst.gstr1.col.* in app/messages/*.json.
type TFn = ReturnType<typeof useTranslations>;

const B2B_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.gstin'), dataIndex: 'ctin', width: 160 },
  { title: t('gstr1.col.partyName'), dataIndex: 'partyName', width: 180, ellipsis: true },
  { title: t('gstr1.col.invoiceNo'), dataIndex: 'inum', width: 130 },
  { title: t('gstr1.col.date'), dataIndex: 'idt', width: 90 },
  {
    title: t('gstr1.col.value'),
    dataIndex: 'val',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  { title: t('gstr1.col.taxRate'), dataIndex: 'rt', width: 80 },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.cgst'),
    dataIndex: 'camt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.sgst'),
    dataIndex: 'samt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const B2CL_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.invoiceNo'), dataIndex: 'inum', width: 130 },
  { title: t('gstr1.col.date'), dataIndex: 'idt', width: 90 },
  { title: t('gstr1.col.state'), dataIndex: 'pos', width: 120 },
  {
    title: t('gstr1.col.value'),
    dataIndex: 'val',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  { title: t('gstr1.col.taxRate'), dataIndex: 'rt', width: 80 },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const B2CS_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.state'), dataIndex: 'pos', width: 140 },
  { title: t('gstr1.col.taxRate'), dataIndex: 'rt', width: 80 },
  {
    title: t('gstr1.col.taxableValue'),
    dataIndex: 'txval',
    width: 140,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.cgst'),
    dataIndex: 'camt',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.sgst'),
    dataIndex: 'samt',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const CDN_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.noteNo'), dataIndex: 'nt_num', width: 130 },
  { title: t('gstr1.col.noteDate'), dataIndex: 'nt_dt', width: 90 },
  {
    title: t('gstr1.col.type'),
    dataIndex: 'ntty',
    width: 80,
    render: (v: string) => <Tag>{v}</Tag>,
  },
  { title: t('gstr1.col.partyGstin'), dataIndex: 'ctin', width: 160 },
  { title: t('gstr1.col.originalInvoice'), dataIndex: 'sourceInvoiceNo', width: 130 },
  {
    title: t('gstr1.col.value'),
    dataIndex: 'val',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.cgst'),
    dataIndex: 'camt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.sgst'),
    dataIndex: 'samt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const HSN_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.hsnCode'), dataIndex: 'hsn_sc', width: 100 },
  { title: t('gstr1.col.description'), dataIndex: 'desc', width: 200, ellipsis: true },
  {
    title: t('gstr1.col.type'),
    dataIndex: 'ty',
    width: 70,
    render: (v: string) => <Tag color={v === 'B2B' ? 'blue' : 'green'}>{v}</Tag>,
  },
  { title: t('gstr1.col.uqc'), dataIndex: 'uqc', width: 80 },
  { title: t('gstr1.col.qty'), dataIndex: 'qty', width: 90, align: 'right' as const },
  {
    title: t('gstr1.col.taxableValue'),
    dataIndex: 'txval',
    width: 130,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.cgst'),
    dataIndex: 'camt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.sgst'),
    dataIndex: 'samt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const DOC_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.series'), dataIndex: 'series', width: 120 },
  { title: t('gstr1.col.fromNo'), dataIndex: 'from', width: 110 },
  { title: t('gstr1.col.toNo'), dataIndex: 'to', width: 110 },
  { title: t('gstr1.col.total'), dataIndex: 'totnum', width: 80 },
  { title: t('gstr1.col.cancelled'), dataIndex: 'cancel', width: 80 },
];

const NIL_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.supplyType'), dataIndex: 'sply_ty', width: 160 },
  {
    title: t('gstr1.col.nilRated'),
    dataIndex: 'nil_amt',
    width: 130,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.exempt'),
    dataIndex: 'expt_amt',
    width: 130,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.nonGst'),
    dataIndex: 'ngsup_amt',
    width: 130,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const AT_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.gstinState'), dataIndex: 'pos', width: 160 },
  {
    title: t('gstr1.col.advance'),
    dataIndex: 'ad_amt',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  { title: t('gstr1.col.taxRate'), dataIndex: 'rt', width: 80 },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.cgst'),
    dataIndex: 'camt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  {
    title: t('gstr1.col.sgst'),
    dataIndex: 'samt',
    width: 110,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
];

const EXP_COLUMNS = (t: TFn) => [
  { title: t('gstr1.col.invoiceNo'), dataIndex: 'inum', width: 130 },
  { title: t('gstr1.col.date'), dataIndex: 'idt', width: 90 },
  { title: t('gstr1.col.exportType'), dataIndex: 'exp_typ', width: 100 },
  {
    title: t('gstr1.col.igst'),
    dataIndex: 'iamt',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatINR((v ?? 0) * 100),
  },
  { title: t('gstr1.col.shippingBillNo'), dataIndex: 'sbnum', width: 140 },
  { title: t('gstr1.col.port'), dataIndex: 'sbpcode', width: 80 },
];

// ── Findings columns ─────────────────────────────────────────────────────────

const FINDING_COLUMNS = (firmId: string, t: TFn) => [
  { title: t('gstr1.col.check'), dataIndex: 'checkId', width: 200 },
  { title: t('gstr1.col.invoiceNo'), dataIndex: 'affectedDocNo', width: 140 },
  {
    title: t('gstr1.col.date'),
    dataIndex: 'scannedAt',
    width: 100,
    render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
  },
  {
    title: t('gstr1.col.party'),
    dataIndex: 'affectedPartyId',
    width: 180,
    ellipsis: true,
    render: (v: string) => (
      <Tooltip title={v}>
        <span>{v ?? '-'}</span>
      </Tooltip>
    ),
  },
  {
    title: t('gstr1.col.severity'),
    dataIndex: 'severity',
    width: 80,
    render: (v: string) => (
      <Tag color={v === 'error' ? 'red' : 'orange'}>
        {v === 'error' ? t('gstr1.severity.error') : t('gstr1.severity.warning')}
      </Tag>
    ),
  },
  {
    title: t('gstr1.col.fix'),
    dataIndex: 'fixRoute',
    width: 60,
    render: (v: string) => (
      <Link href={v} style={{ color: 'var(--cr-primary)' }}>
        {t('gstr1.col.fix')}
      </Link>
    ),
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Gstr1Page() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.gstr1.* (and shared finance.gst.common.*).
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs().subtract(1, 'month'));
  const period = selectedMonth.format('MMYYYY');

  const [report, setReport] = useState<Gstr1Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [findings, setFindings] = useState<VerifyDataFinding[] | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('b2b');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['b2b']));
  // Error/retry pair: any failed fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(
    async (p: string) => {
      if (!wsId || !firmId || gstAccess.isLocked) return;

      setError(false);

      // Load validation
      setFindingsLoading(true);
      validateGstr1(wsId, firmId, p)
        .then((res) => setFindings(res.findings))
        .catch(() => {
          setFindings([]);
          setError(true);
        })
        .finally(() => setFindingsLoading(false));

      // Load full report
      setReportLoading(true);
      getGstr1Report(wsId, firmId, p)
        .then((res) => setReport(res))
        .catch(() => {
          setReport(null);
          setError(true);
        })
        .finally(() => setReportLoading(false));
    },
    [wsId, firmId, gstAccess.isLocked],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadData(period), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [period, loadData, reloadKey]);

  function handleTabChange(key: string) {
    setActiveTab(key);
    setLoadedTabs((prev) => new Set([...prev, key]));
  }

  async function handleExportJson() {
    if (!wsId || !firmId) return;
    try {
      const payload = await exportGstr1Json(wsId, firmId, period);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${period}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('gstr1.exportDone'));
    } catch {
      message.error(t('gstr1.exportError'));
    }
  }

  const counts = report?._counts ?? {};
  const errorCount = findings?.filter((f) => f.severity === 'error').length ?? 0;
  const warningCount = findings?.filter((f) => f.severity === 'warning').length ?? 0;

  // Tab data helpers
  function b2bRows(): any[] {
    return (report?.b2b ?? []).flatMap((entry: any) =>
      (entry.inv ?? []).map((inv: any) => ({
        ...inv,
        ctin: entry.ctin,
        partyName: entry.partyName,
        key: inv.inum,
      })),
    );
  }

  const tabs: TabsProps['items'] = [
    {
      key: 'b2b',
      label: (
        <span>
          {t('gstr1.tab.b2b')}{' '}
          {counts.b2b !== undefined ? (
            <Badge count={counts.b2b} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={b2bRows()}
          columns={B2B_COLUMNS(t)}
          rowKey={(r: any) => r.inum ?? Math.random()}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'b2cl',
      label: (
        <span>
          {t('gstr1.tab.b2cl')}{' '}
          {counts.b2cl !== undefined ? (
            <Badge count={counts.b2cl} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.b2cl ?? []}
          columns={B2CL_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'b2cs',
      label: (
        <span>
          {t('gstr1.tab.b2cs')}{' '}
          {counts.b2cs !== undefined ? (
            <Badge count={counts.b2cs} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.b2cs ?? []}
          columns={B2CS_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'cdnr',
      label: (
        <span>
          {t('gstr1.tab.cdnr')}{' '}
          {counts.cdnr !== undefined ? (
            <Badge count={counts.cdnr} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.cdnr ?? []}
          columns={CDN_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'cdnur',
      label: (
        <span>
          {t('gstr1.tab.cdnur')}{' '}
          {counts.cdnur !== undefined ? (
            <Badge count={counts.cdnur} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.cdnur ?? []}
          columns={CDN_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'hsn',
      label: (
        <span>
          {t('gstr1.tab.hsn')}{' '}
          {counts.hsn !== undefined ? (
            <Badge count={counts.hsn} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.hsn?.data ?? []}
          columns={HSN_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'doc',
      label: t('gstr1.tab.doc'),
      children: (
        <DsTable
          dataSource={report?.doc_issue?.doc_det ?? []}
          columns={DOC_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'nil',
      label: t('gstr1.tab.nil'),
      children: (
        <DsTable
          dataSource={report?.nil?.inv ?? []}
          columns={NIL_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'at',
      label: t('gstr1.tab.atadj'),
      children: (
        <DsTable
          dataSource={[...(report?.at ?? []), ...(report?.atadj ?? [])]}
          columns={AT_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'exp',
      label: (
        <span>
          {t('gstr1.tab.exp')}{' '}
          {counts.exp !== undefined ? (
            <Badge count={counts.exp} color="var(--cr-primary)" style={{ boxShadow: 'none' }} />
          ) : (
            <span style={{ color: 'var(--cr-text-5)' }}>-</span>
          )}
        </span>
      ),
      children: (
        <DsTable
          dataSource={report?.exp ?? []}
          columns={EXP_COLUMNS(t)}
          rowKey={(_: any, i?: number) => i ?? 0}
          scrollX="max-content"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records`, showSizeChanger: false }}
          size="small"
        />
      ),
    },
  ];

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
        title={t('gstr1.title')}
        icon={<FileDoneOutlined />}
        titleAside={<InfoTooltip text={t('gstr1.info')} />}
        right={
          <div className="flex items-center gap-sm">
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(val) => val && setSelectedMonth(val)}
              format="MMM YYYY"
              allowClear={false}
              style={{ width: 130 }}
            />
            <DsButton dsVariant="ghost" onClick={() => message.info(t('gstr1.printSoon'))}>
              {t('gstr1.printSummary')}
            </DsButton>
            <DsButton dsVariant="primary" onClick={handleExportJson}>
              {t('common.exportJson')}
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
      ) : (
        <>
          {/* Pre-flight Validator */}
          <div className="mb-md">
            {findingsLoading ? (
              <Skeleton.Button active style={{ width: '100%', height: 48 }} />
            ) : findings !== null ? (
              <>
                <Alert
                  type={errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success'}
                  title={
                    errorCount > 0
                      ? t('gstr1.validation.errorsWarnings', {
                          errors: errorCount,
                          warnings: warningCount,
                        })
                      : warningCount > 0
                        ? t('gstr1.validation.warningsOnly', { warnings: warningCount })
                        : t('gstr1.validation.passed')
                  }
                  showIcon
                  style={{ marginBottom: findings.length > 0 ? 0 : undefined }}
                />
                {findings.length > 0 && (
                  <Collapse
                    ghost
                    items={[
                      {
                        key: 'findings',
                        label: t('gstr1.validation.viewFindings', { count: findings.length }),
                        children: (
                          <DsTable
                            dataSource={findings}
                            columns={FINDING_COLUMNS(firmId, t)}
                            rowKey={(r: VerifyDataFinding) => r.checkId + r.affectedDocId}
                            scrollX="max-content"
                            pagination={false}
                            size="small"
                          />
                        ),
                      },
                    ]}
                  />
                )}
              </>
            ) : null}
          </div>

          {/* Section Tabs */}
          {reportLoading ? (
            <div className="p-md">
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          ) : !report ? (
            <div className="p-xl text-center" style={{ color: 'var(--cr-text-3)' }}>
              <p className="font-display text-[20px] font-bold">{t('gstr1.empty.title')}</p>
              <p>{t('gstr1.empty.body')}</p>
            </div>
          ) : (
            <Tabs
              type="line"
              activeKey={activeTab}
              onChange={handleTabChange}
              items={tabs}
              tabBarStyle={{ marginBottom: 16 }}
            />
          )}
        </>
      )}
    </div>
  );
}
