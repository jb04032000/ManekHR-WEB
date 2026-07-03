'use client';

import { useCallback, useMemo, useState } from 'react';
import { App, Button, Checkbox, Empty, Select, Skeleton, Space, Tag, Tooltip } from 'antd';
import { DownloadOutlined, EyeOutlined, MailOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { formatCurrencyFull } from '@/lib/utils';
import { blobToBase64 } from '@/lib/utils/blobToBase64';
import { PayslipPreviewModal } from '@/components/dashboard/team/PayslipPreviewModal';
import type { LedgerRecord, LedgerMonth } from '@/types';

interface PayslipsTabProps {
  memberName: string;
  memberEmail?: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
}

type RangeMode = 'fy' | 'custom';

const STATUS_COLOR: Record<string, string> = {
  paid: 'success',
  partial: 'warning',
  pending: 'error',
  advance: 'processing',
};

// Returns "2025-26" label and {start, end} monthKey bounds for a FY
function fyLabel(startYear: number) {
  return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
}
function fyBounds(startYear: number) {
  return {
    start: `${startYear}-04`,
    end: `${startYear + 1}-03`,
  };
}

// Derive which FY a monthKey (YYYY-MM) belongs to
function monthKeyToFyStart(mk: string): number {
  const [y, m] = mk.split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

// Current FY start year
function currentFyStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function monthKeyToLabel(mk: string) {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function PayslipsTab({
  memberName,
  memberEmail,
  ledger,
  ledgerLoading,
}: PayslipsTabProps) {
  const t = useTranslations('salary.payslipsTab');
  const { message: msgApi } = App.useApp();
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { payslipGeneration, payslipEmail } = useSalaryFeatures();

  // ── Range state ───────────────────────────────────────────────────────────
  const [rangeMode, setRangeMode] = useState<RangeMode>('fy');
  const [selectedFy, setSelectedFy] = useState<number>(currentFyStart());

  // Custom range: monthKey strings like "2025-07"
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [customApplied, setCustomApplied] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Preview modal ─────────────────────────────────────────────────────────
  const [previewSalaryId, setPreviewSalaryId] = useState<string | null>(null);
  const [previewMonthLabel, setPreviewMonthLabel] = useState('');

  // ── Per-row loading ───────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkEmailing, setBulkEmailing] = useState(false);
  const [yearDownloading, setYearDownloading] = useState(false);

  // ── Derive available FY options from ledger ───────────────────────────────
  const fyOptions = useMemo<number[]>(() => {
    if (!ledger?.months.length) return [currentFyStart()];
    const fySet = new Set(ledger.months.map((m) => monthKeyToFyStart(m.monthKey)));
    return Array.from(fySet).sort((a, b) => b - a);
  }, [ledger]);

  // ── Derive month+year select options for custom range ────────────────────
  const allMonthKeys = useMemo<string[]>(() => {
    if (!ledger?.months.length) return [];
    return [...ledger.months.map((m) => m.monthKey)].sort();
  }, [ledger]);

  // ── Filtered months for display ───────────────────────────────────────────
  const visibleMonths = useMemo<LedgerMonth[]>(() => {
    if (!ledger?.months.length) return [];
    const months = [...ledger.months].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    if (rangeMode === 'fy') {
      const { start, end } = fyBounds(selectedFy);
      return months.filter((m) => m.monthKey >= start && m.monthKey <= end);
    }
    // custom
    const from = customApplied?.from ?? '';
    const to = customApplied?.to ?? '';
    if (!from || !to) return months;
    return months.filter((m) => m.monthKey >= from && m.monthKey <= to);
  }, [ledger, rangeMode, selectedFy, customApplied]);

  const currencySymbol = usePayrollConfigStore.getState().getCurrencyConfig().symbol;
  const fmt = (n: number) => formatCurrencyFull(n, currencySymbol, 'en-IN');

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allVisibleIds = visibleMonths.map((m) => m.salaryId);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedMonths = visibleMonths.filter((m) => selected.has(m.salaryId));

  // ── Single download ───────────────────────────────────────────────────────
  const handleDownloadOne = useCallback(
    async (month: LedgerMonth) => {
      if (!currentWorkspaceId) return;
      setDownloadingId(month.salaryId);
      try {
        const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
        const [dataArr, { generatePayslipPdf }] = await Promise.all([
          salaryApi.getPayslipData(currentWorkspaceId, [month.salaryId]),
          import('@/lib/export/generatePayslipPdf'),
        ]);
        const data = dataArr[0];
        if (!data) throw new Error('No payslip data');
        await generatePayslipPdf({
          payslips: [
            {
              record: data.record,
              adjustments: data.adjustments,
              payments: data.payments,
              componentTemplate: data.componentTemplate,
              workspaceName: data.workspaceName,
              branding: data.branding,
              currencyConfig,
              advanceOutstanding: data.advanceOutstanding,
              loanOutstanding: data.loanOutstanding,
            },
          ],
          mode: 'individual',
        });
        msgApi.success('Payslip downloaded');
      } catch {
        msgApi.error('Failed to generate payslip');
      } finally {
        setDownloadingId(null);
      }
    },
    [currentWorkspaceId, msgApi],
  );

  // ── Single email ──────────────────────────────────────────────────────────
  const handleEmailOne = useCallback(
    async (month: LedgerMonth) => {
      if (!currentWorkspaceId) return;
      setEmailingId(month.salaryId);
      try {
        await salaryApi.sendPayslipEmail(currentWorkspaceId, {
          salaryId: month.salaryId,
        });
        msgApi.success(
          t('emailSuccess', { monthLabel: month.monthLabel, email: memberEmail ?? '' }),
        );
      } catch {
        msgApi.error(t('emailError'));
      } finally {
        setEmailingId(null);
      }
    },
    [currentWorkspaceId, memberEmail, msgApi, t],
  );

  // ── Bulk download ZIP ─────────────────────────────────────────────────────
  const handleBulkZip = useCallback(async () => {
    if (!currentWorkspaceId || selectedMonths.length === 0) return;
    setBulkDownloading(true);
    msgApi.loading(`Generating ${selectedMonths.length} payslips…`, 0);
    try {
      const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
      const salaryIds = selectedMonths.map((m) => m.salaryId);
      const [dataArr, { generatePayslipPdf }, { downloadAsZip }] = await Promise.all([
        salaryApi.getPayslipData(currentWorkspaceId, salaryIds),
        import('@/lib/export/generatePayslipPdf'),
        import('@/lib/export/zipDownload'),
      ]);
      const payslips = dataArr.map((d) => ({
        record: d.record,
        adjustments: d.adjustments,
        payments: d.payments,
        componentTemplate: d.componentTemplate,
        workspaceName: d.workspaceName,
        branding: d.branding,
        currencyConfig,
        advanceOutstanding: d.advanceOutstanding,
        loanOutstanding: d.loanOutstanding,
      }));
      const results = await generatePayslipPdf({
        payslips,
        mode: 'individual',
      });
      await downloadAsZip(results, `Payslips_${memberName.replace(/\s+/g, '_')}.zip`);
      msgApi.destroy();
      msgApi.success(`${results.length} payslips downloaded`);
    } catch {
      msgApi.destroy();
      msgApi.error('Failed to generate payslips ZIP');
    } finally {
      setBulkDownloading(false);
    }
  }, [currentWorkspaceId, selectedMonths, memberName, msgApi]);

  // ── Bulk email ────────────────────────────────────────────────────────────
  const handleBulkEmail = useCallback(async () => {
    if (!currentWorkspaceId || selectedMonths.length === 0) return;
    setBulkEmailing(true);
    msgApi.loading(`Sending ${selectedMonths.length} payslips…`, 0);
    try {
      const items = selectedMonths.map((m) => ({ salaryId: m.salaryId }));
      await salaryApi.sendBulkPayslipEmails(currentWorkspaceId, { items });
      msgApi.destroy();
      msgApi.success(t('bulkEmailSuccess', { count: items.length, email: memberEmail ?? '' }));
      setSelected(new Set());
    } catch {
      msgApi.destroy();
      msgApi.error(t('bulkEmailError'));
    } finally {
      setBulkEmailing(false);
    }
  }, [currentWorkspaceId, selectedMonths, memberEmail, msgApi, t]);

  // ── Year statement (combined PDF) ─────────────────────────────────────────
  const handleYearStatement = useCallback(async () => {
    if (!currentWorkspaceId || visibleMonths.length === 0) return;
    setYearDownloading(true);
    try {
      const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
      const salaryIds = visibleMonths.map((m) => m.salaryId);
      const [dataArr, { generatePayslipPdf }] = await Promise.all([
        salaryApi.getPayslipData(currentWorkspaceId, salaryIds),
        import('@/lib/export/generatePayslipPdf'),
      ]);
      const payslips = dataArr.map((d) => ({
        record: d.record,
        adjustments: d.adjustments,
        payments: d.payments,
        componentTemplate: d.componentTemplate,
        workspaceName: d.workspaceName,
        branding: d.branding,
        currencyConfig,
        advanceOutstanding: d.advanceOutstanding,
        loanOutstanding: d.loanOutstanding,
      }));
      await generatePayslipPdf({ payslips, mode: 'combined' });
      msgApi.success('Year statement downloaded');
    } catch {
      msgApi.error('Failed to generate year statement');
    } finally {
      setYearDownloading(false);
    }
  }, [currentWorkspaceId, visibleMonths, msgApi]);

  // ── Upgrade gate ──────────────────────────────────────────────────────────
  if (!payslipGeneration.enabled) {
    return (
      <div className="space-y-2 py-12 text-center">
        <FilePdfOutlined className="text-4xl text-faint" />
        <div className="font-medium text-gray-700">{t('gateTitle')}</div>
        <div className="text-sm text-faint">{t('gateDescription')}</div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (ledgerLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  // ── No ledger / no months ─────────────────────────────────────────────────
  if (!ledger?.months.length) {
    return (
      <Empty
        description={
          <span className="text-faint">
            No payslips yet. Generate payroll from the Salary module first.
          </span>
        }
      />
    );
  }

  const noEmail = !memberEmail;

  return (
    <>
      {/* ── Controls bar ───────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* FY / Custom toggle */}
        <div className="inline-flex gap-2">
          <Button
            size="small"
            type={rangeMode === 'fy' ? 'primary' : 'default'}
            onClick={() => setRangeMode('fy')}
          >
            Financial Year
          </Button>
          <Button
            size="small"
            type={rangeMode === 'custom' ? 'primary' : 'default'}
            onClick={() => setRangeMode('custom')}
          >
            Custom Range
          </Button>
        </div>

        {/* FY selector */}
        {rangeMode === 'fy' && (
          <Select
            size="small"
            value={selectedFy}
            onChange={setSelectedFy}
            options={fyOptions.map((y) => ({ value: y, label: fyLabel(y) }))}
            style={{ width: 130 }}
          />
        )}

        {/* Custom range pickers */}
        {rangeMode === 'custom' && (
          <div className="flex items-center gap-2">
            <Select
              size="small"
              placeholder={t('rangeCustomFrom')}
              value={customFrom || undefined}
              onChange={setCustomFrom}
              options={allMonthKeys.map((mk) => ({
                value: mk,
                label: monthKeyToLabel(mk),
              }))}
              style={{ width: 120 }}
            />
            <span className="text-faint">{t('rangeCustomTo')}</span>
            <Select
              size="small"
              placeholder={t('rangeCustomTo')}
              value={customTo || undefined}
              onChange={setCustomTo}
              options={allMonthKeys
                .filter((mk) => !customFrom || mk >= customFrom)
                .map((mk) => ({
                  value: mk,
                  label: monthKeyToLabel(mk),
                }))}
              style={{ width: 120 }}
            />
            <Button
              size="small"
              type="primary"
              disabled={!customFrom || !customTo}
              onClick={() => setCustomApplied({ from: customFrom, to: customTo })}
            >
              {t('rangeCustomApply')}
            </Button>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Select all */}
        <Checkbox
          indeterminate={someSelected && !allSelected}
          checked={allSelected}
          onChange={toggleAll}
        >
          {t('selectAll')}
        </Checkbox>

        {/* Bulk actions - only when selection active */}
        {someSelected && (
          <>
            <Tooltip title={t('bulkDownloadTooltip')}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={bulkDownloading}
                onClick={handleBulkZip}
              >
                {t('bulkZipButton', { count: selectedMonths.length })}
              </Button>
            </Tooltip>
            <Tooltip
              title={
                noEmail
                  ? t('bulkEmailNoEmail')
                  : !payslipEmail.enabled
                    ? t('bulkEmailUpgrade')
                    : t('bulkEmailTooltip', { count: selectedMonths.length })
              }
            >
              <Button
                size="small"
                icon={<MailOutlined />}
                loading={bulkEmailing}
                disabled={noEmail || !payslipEmail.enabled}
                onClick={handleBulkEmail}
              >
                {t('bulkEmailButton', { count: selectedMonths.length })}
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      {/* ── Month rows ─────────────────────────────────────────────────── */}
      {visibleMonths.length === 0 ? (
        <Empty description={<span className="text-faint">{t('emptyPeriod')}</span>} />
      ) : (
        <div className="space-y-3">
          {visibleMonths.map((month) => {
            const isSelected = selected.has(month.salaryId);
            const isDownloading = downloadingId === month.salaryId;
            const isEmailing = emailingId === month.salaryId;
            const canEmail = !noEmail && payslipEmail.enabled && month.status !== 'pending';

            return (
              <div
                key={month.salaryId}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors ${
                  isSelected
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Checkbox checked={isSelected} onChange={() => toggleOne(month.salaryId)} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{month.monthLabel}</span>
                    {!month.isLocked && (
                      <Tag variant="filled" color="warning" className="text-xs">
                        {t('draftTag')}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-faint">
                    {t('netLabel', { amount: fmt(month.salary) })}
                  </div>
                </div>

                <Tag
                  color={STATUS_COLOR[month.status] ?? 'default'}
                  className="shrink-0 capitalize"
                >
                  {month.status}
                </Tag>

                {/* Row actions */}
                <Space size="small">
                  <Tooltip title={t('previewTooltip')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        setPreviewSalaryId(month.salaryId);
                        setPreviewMonthLabel(month.monthLabel);
                      }}
                    />
                  </Tooltip>

                  <Tooltip title={t('downloadTooltip')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={isDownloading}
                      onClick={() => handleDownloadOne(month)}
                    />
                  </Tooltip>

                  <Tooltip
                    title={
                      noEmail
                        ? t('emailNoEmail')
                        : !payslipEmail.enabled
                          ? t('emailUpgrade')
                          : month.status === 'pending'
                            ? t('emailPending')
                            : t('emailTooltip')
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MailOutlined />}
                      loading={isEmailing}
                      disabled={!canEmail}
                      onClick={() => handleEmailOne(month)}
                    />
                  </Tooltip>
                </Space>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Year statement ─────────────────────────────────────────────── */}
      {visibleMonths.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <Button
            icon={<FilePdfOutlined />}
            loading={yearDownloading}
            onClick={handleYearStatement}
          >
            {t('yearStatementButton', {
              count: visibleMonths.length,
              unit: visibleMonths.length === 1 ? t('yearStatementMonth') : t('yearStatementMonths'),
            })}
          </Button>
        </div>
      )}

      {/* ── Preview modal ───────────────────────────────────────────────── */}
      <PayslipPreviewModal
        open={!!previewSalaryId}
        salaryId={previewSalaryId}
        monthLabel={previewMonthLabel}
        memberEmail={memberEmail}
        onClose={() => setPreviewSalaryId(null)}
      />
    </>
  );
}
