'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DatePicker, Spin, InputNumber, Tooltip, message } from 'antd';
import { EditOutlined, LockOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import {
  getGstr3bReport,
  saveGstr3bAdjustments,
  exportGstr3bJson,
} from '@/lib/actions/finance/gst.actions';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { Gstr3bMergedReport, Gstr3bCellValue } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

function formatINR(paise: number): string {
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

type CellKey = string;

interface EditingState {
  key: CellKey;
  value: number;
}

export default function Gstr3bPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.gstr3b.* (and shared finance.gst.common.*).
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs().subtract(1, 'month'));
  const period = selectedMonth.format('MMYYYY');

  const [report, setReport] = useState<Gstr3bMergedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localAdjustments, setLocalAdjustments] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<EditingState | null>(null);
  // Error/retry pair: a failed report fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadReport = useCallback(
    async (p: string) => {
      if (!wsId || !firmId || gstAccess.isLocked) return;
      setLoading(true);
      setError(false);
      setLocalAdjustments({});
      getGstr3bReport(wsId, firmId, p)
        .then((res) => setReport(res))
        .catch(() => {
          setReport(null);
          setError(true);
          message.error(t('gstr3b.loadError'));
        })
        .finally(() => setLoading(false));
    },
    [wsId, firmId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadReport(period), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [period, loadReport, reloadKey]);

  // Look up a merged cell by its flat key (e.g. '3.1.a.txval'). The backend
  // returns all values under report.finalValues keyed by these flat keys.
  function cellOf(cellKey: string): Gstr3bCellValue | undefined {
    return report?.finalValues?.[cellKey];
  }

  function getCellDisplayValue(cell: Gstr3bCellValue | undefined, cellKey: string): number {
    if (localAdjustments[cellKey] !== undefined) return localAdjustments[cellKey];
    if (!cell) return 0;
    return cell.isManual ? cell.manualValue : cell.autoValue;
  }

  function getCellAutoValue(cell: Gstr3bCellValue | undefined): number {
    return cell?.autoValue ?? 0;
  }

  function isCellManual(cell: Gstr3bCellValue | undefined, cellKey: string): boolean {
    if (localAdjustments[cellKey] !== undefined) return true;
    return cell?.isManual ?? false;
  }

  function isCellNov2025Locked(cell: Gstr3bCellValue | undefined): boolean {
    return cell?.nov2025Locked ?? false;
  }

  // Aggregate display value across several cells (Table 5 is one row in the UI
  // but eight keys in the data: exempt/nil/non-GST/composition x inter/intra).
  function sumCellValues(cellKeys: string[]): number {
    return cellKeys.reduce((total, key) => total + getCellDisplayValue(cellOf(key), key), 0);
  }

  function handleCellClick(cellKey: string, currentValue: number) {
    setEditing({ key: cellKey, value: currentValue });
  }

  function handleCellBlur(cellKey: string, newValue: number | null) {
    if (newValue !== null && newValue !== undefined) {
      setLocalAdjustments((prev) => ({ ...prev, [cellKey]: newValue }));
    }
    setEditing(null);
  }

  async function handleSaveAdjustments() {
    if (!wsId || !firmId || Object.keys(localAdjustments).length === 0) return;
    setSaving(true);
    try {
      await saveGstr3bAdjustments(wsId, firmId, period, localAdjustments);
      message.success(t('gstr3b.saved'));
    } catch {
      message.error(t('gstr3b.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportJson() {
    if (!wsId || !firmId) return;
    try {
      const payload = await exportGstr3bJson(wsId, firmId, period);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR3B_${period}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('gstr3b.exportDone'));
    } catch {
      message.error(t('gstr3b.exportError'));
    }
  }

  function renderCell(cellKey: string) {
    const cell = cellOf(cellKey);
    const displayValue = getCellDisplayValue(cell, cellKey);
    const autoValue = getCellAutoValue(cell);
    const isManual = isCellManual(cell, cellKey);
    const isLocked = isCellNov2025Locked(cell);

    if (editing?.key === cellKey) {
      return (
        <InputNumber
          value={editing.value / 100}
          autoFocus
          style={{ width: 160 }}
          formatter={(v) => `₹${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onBlur={(e) => {
            const raw = parseFloat(e.target.value.replace(/[₹,]/g, ''));
            handleCellBlur(cellKey, isNaN(raw) ? null : Math.round(raw * 100));
          }}
          onPressEnter={(e) => {
            const raw = parseFloat((e.target as HTMLInputElement).value.replace(/[₹,]/g, ''));
            handleCellBlur(cellKey, isNaN(raw) ? null : Math.round(raw * 100));
          }}
        />
      );
    }

    return (
      <div
        className="flex cursor-pointer items-center gap-xs rounded px-2 py-1"
        style={{
          background: isManual ? 'var(--cr-warning-bg, var(--cr-warning-50))' : 'transparent',
          border: isManual
            ? '1px solid var(--cr-warning, var(--cr-warning-700))'
            : '1px solid transparent',
          minWidth: 120,
        }}
        onClick={() => handleCellClick(cellKey, displayValue)}
      >
        <span>{formatINR(displayValue)}</span>
        {isManual && (
          <Tooltip title={t('gstr3b.manualTip', { value: formatINR(autoValue) })}>
            <EditOutlined
              style={{ fontSize: 12, color: 'var(--cr-warning, var(--cr-warning-700))' }}
            />
          </Tooltip>
        )}
        {isLocked && (
          <Tooltip title={t('gstr3b.lockedCellTip')}>
            <LockOutlined style={{ fontSize: 12, color: 'var(--cr-text-4)' }} />
          </Tooltip>
        )}
      </div>
    );
  }

  const sectionHeaderStyle: React.CSSProperties = {
    background: 'var(--cr-surface-2)',
    fontWeight: 700,
    color: 'var(--cr-text)',
    padding: '8px 16px',
  };

  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--cr-border)',
  };

  const labelStyle: React.CSSProperties = {
    padding: '8px 16px',
    color: 'var(--cr-text-2)',
    width: 400,
  };

  const valueStyle: React.CSSProperties = {
    padding: '8px 16px',
    width: 200,
  };

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
        title={t('gstr3b.title')}
        icon={<FileTextOutlined />}
        titleAside={<InfoTooltip text={t('gstr3b.info')} />}
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
            <DsButton
              dsVariant="ghost"
              onClick={() => {
                loadReport(period);
              }}
            >
              {t('gstr3b.recompute')}
            </DsButton>
            <DsButton
              dsVariant="secondary"
              onClick={handleSaveAdjustments}
              loading={saving}
              disabled={Object.keys(localAdjustments).length === 0}
            >
              {t('gstr3b.saveAdjustments')}
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
      ) : loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
          <Spin tip={t('gstr3b.loading')} size="large" />
        </div>
      ) : !report ? (
        <div className="p-xl text-center" style={{ color: 'var(--cr-text-3)' }}>
          <p>{t('gstr3b.selectPeriod')}</p>
        </div>
      ) : (
        <>
          {/* GSTR-3B Table */}
          <div
            className="mb-xl overflow-hidden rounded-lg"
            style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 400 }} />
                <col style={{ width: 200 }} />
              </colgroup>

              {/* 3.1 Outward Supplies */}
              <tbody>
                <tr style={rowStyle}>
                  <td colSpan={2} style={sectionHeaderStyle}>
                    {t('gstr3b.section.s31')}
                  </td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s31a')}</td>
                  <td style={valueStyle}>{renderCell('3.1.a.txval')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s31b')}</td>
                  <td style={valueStyle}>{renderCell('3.1.b.txval')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s31c')}</td>
                  <td style={valueStyle}>{renderCell('3.1.c.txval')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s31d')}</td>
                  <td style={valueStyle}>{renderCell('3.1.d.txval')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s31e')}</td>
                  <td style={valueStyle}>{renderCell('3.1.e.txval')}</td>
                </tr>

                {/* 3.2 Inter-State Supplies */}
                <tr style={rowStyle}>
                  <td colSpan={2} style={sectionHeaderStyle}>
                    {t('gstr3b.section.s32')}
                    {report.nov2025Locked && (
                      <Tooltip title={t('gstr3b.lockedSectionTip')}>
                        <LockOutlined
                          style={{ marginLeft: 8, fontSize: 12, color: 'var(--cr-text-4)' }}
                        />
                      </Tooltip>
                    )}
                  </td>
                </tr>

                {/* 4 Eligible ITC */}
                <tr style={rowStyle}>
                  <td colSpan={2} style={sectionHeaderStyle}>
                    {t('gstr3b.section.s4')}
                  </td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s4a1')}</td>
                  <td style={valueStyle}>{renderCell('4A.1.igst')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s4a3')}</td>
                  <td style={valueStyle}>{renderCell('4A.3.igst')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s4a5')}</td>
                  <td style={valueStyle}>{renderCell('4A.5.igst')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s4b1')}</td>
                  <td style={valueStyle}>{renderCell('4B.1.igst')}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s4b2')}</td>
                  <td style={valueStyle}>{renderCell('4B.2.igst')}</td>
                </tr>

                {/* 5 Exempt/Nil/Non-GST */}
                <tr style={rowStyle}>
                  <td colSpan={2} style={sectionHeaderStyle}>
                    {t('gstr3b.section.s5')}
                  </td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.s5row')}</td>
                  <td style={valueStyle}>
                    {/* Table 5 is one UI row but eight data keys; show the total (informational, no override). */}
                    <div className="px-2 py-1">
                      <span>
                        {formatINR(
                          sumCellValues([
                            '5.exempt.inter',
                            '5.exempt.intra',
                            '5.nil.inter',
                            '5.nil.intra',
                            '5.non_gst.inter',
                            '5.non_gst.intra',
                            '5.composition.inter',
                            '5.composition.intra',
                          ]),
                        )}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* 6.1 Interest and Late Fees */}
                <tr style={rowStyle}>
                  <td colSpan={2} style={sectionHeaderStyle}>
                    {t('gstr3b.section.s61')}
                  </td>
                </tr>
                <tr style={rowStyle}>
                  <td style={labelStyle}>{t('gstr3b.section.interest')}</td>
                  <td style={valueStyle}>{renderCell('6.1.igst')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Tax Liability Summary */}
          <div
            className="mb-xl rounded-lg p-md"
            style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
          >
            <h3 className="mb-md text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('gstr3b.summary.title')}
            </h3>
            <div className="grid grid-cols-3 gap-md">
              <div>
                <div
                  className="mb-xs text-[12px] tracking-wide uppercase"
                  style={{ color: 'var(--cr-text-3)' }}
                >
                  {t('gstr3b.summary.igst')}
                </div>
                <div
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-text)' }}
                >
                  {formatINR(getCellDisplayValue(cellOf('3.1.a.igst'), '3.1.a.igst'))}
                </div>
              </div>
              <div>
                <div
                  className="mb-xs text-[12px] tracking-wide uppercase"
                  style={{ color: 'var(--cr-text-3)' }}
                >
                  {t('gstr3b.summary.cgstSgst')}
                </div>
                <div
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-text)' }}
                >
                  {formatINR(
                    getCellDisplayValue(cellOf('3.1.a.cgst'), '3.1.a.cgst') +
                      getCellDisplayValue(cellOf('3.1.a.sgst'), '3.1.a.sgst'),
                  )}
                </div>
              </div>
              <div>
                <div
                  className="mb-xs text-[12px] tracking-wide uppercase"
                  style={{ color: 'var(--cr-text-3)' }}
                >
                  {t('gstr3b.summary.cess')}
                </div>
                <div
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-text)' }}
                >
                  {formatINR(getCellDisplayValue(cellOf('3.1.a.cess'), '3.1.a.cess'))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
