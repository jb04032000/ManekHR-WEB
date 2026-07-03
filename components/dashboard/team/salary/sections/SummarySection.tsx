'use client';

import { useState, useMemo } from 'react';
import { Skeleton, Button, App, Form } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { StatTile } from '@/components/ui';
import { SetSalaryModal } from '@/app/(app)/dashboard/salary/components/salary/SetSalaryModal';
import { setBasePay } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { formatCurrencyFull } from '@/lib/utils';
import type { LedgerRecord, SalaryRecord, EmployeeComponentOverride } from '@/types';

// ── Financial year helpers (mirrors SalaryWorkspace) ─────────────────────────

function currentFyStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fyBounds(startYear: number) {
  return {
    start: `${startYear}-04`,
    end: `${startYear + 1}-03`,
  };
}

// ── Status helper (mirrors getSettlementStatus in useSalaryData) ─────────────

function deriveRecordStatus(record: SalaryRecord): string {
  if (record.settlementStatus) {
    if (record.settlementStatus === 'overpaid') return 'advance';
    return record.settlementStatus;
  }
  if (record.isPreview) {
    const configured = record.effectiveSalary ?? record.baseSalary ?? 0;
    return configured > 0 ? 'not_generated' : 'salary_not_set';
  }
  const paid = record.paidAmount ?? 0;
  const net = record.netSalary ?? 0;
  const base = record.baseSalary ?? 0;
  if (base <= 0) return 'salary_not_set';
  if (net <= 0) return 'salary_not_set';
  if (paid > net) return 'advance';
  if (paid >= net) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SummarySectionProps {
  memberId: string;
  memberName: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  advancesOutstanding?: number | null;
  loanOutstanding?: number | null;
  canAct: boolean;
  /** Called after a successful Set Salary action so the parent can refresh. */
  onChanged?: () => void;
}

// ── SummarySection ────────────────────────────────────────────────────────────

export default function SummarySection({
  memberId,
  memberName,
  ledger,
  ledgerLoading,
  advancesOutstanding,
  loanOutstanding,
  canAct,
  onChanged,
}: SummarySectionProps) {
  const t = useTranslations('team');
  const { message: msgApi } = App.useApp();
  const [setSalaryForm] = Form.useForm();

  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const currencySymbol = usePayrollConfigStore.getState().getCurrencyConfig().symbol;
  const fmt = (n: number) => formatCurrencyFull(n, currencySymbol, 'en-IN');

  // ── Derive KPIs ───────────────────────────────────────────────────────────
  const now = dayjs();
  const currentMonthKey = now.format('YYYY-MM');
  const currentMonthEntry = ledger?.months.find((m) => m.monthKey === currentMonthKey) ?? null;

  const netThisMonth = currentMonthEntry?.salary ?? 0;
  const paidThisMonth = currentMonthEntry?.paid ?? 0;
  const outstanding = currentMonthEntry?.remaining ?? 0;

  const ytdPaid = useMemo(() => {
    if (!ledger?.months.length) return 0;
    const { start, end } = fyBounds(currentFyStart());
    return ledger.months
      .filter((m) => m.monthKey >= start && m.monthKey <= end)
      .reduce((acc, m) => acc + m.paid, 0);
  }, [ledger]);

  // ── SetSalaryModal local state ────────────────────────────────────────────
  const [setSalaryOpen, setSetSalaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salaryMode, setSalaryMode] = useState<'monthly' | 'hourly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK' | undefined>(undefined);
  const [passbookImage, setPassbookImage] = useState<string | File | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | File | null>(null);
  const [sameAsEmployeeName, setSameAsEmployeeName] = useState(false);

  // Build a synthetic SalaryRecord so SetSalaryModal can show member name and
  // determine title ("Set salary" vs "Edit salary"). The record is preview-mode
  // because we are at summary level (not a generated payroll row).
  const syntheticRecord: SalaryRecord = useMemo(
    () => ({
      _id: currentMonthEntry?.salaryId ?? null,
      workspaceId: currentWorkspaceId ?? '',
      teamMemberId: memberId,
      month: now.month() + 1,
      year: now.year(),
      baseSalary: currentMonthEntry?.baseSalary ?? 0,
      totalDays: 0,
      presentDays: 0,
      deductions: 0,
      additions: 0,
      netSalary: currentMonthEntry?.salary ?? 0,
      paidAmount: currentMonthEntry?.paid ?? 0,
      status: (currentMonthEntry?.status ?? 'pending') as SalaryRecord['status'],
      isPreview: !currentMonthEntry?.salaryId,
      teamMember: {
        id: memberId,
        name: memberName,
        hasAppAccess: false,
        isActive: true,
        weeklyOff: [],
        scheduleType: 'shift',
        salaryType: 'monthly',
        salaryAmount: currentMonthEntry?.baseSalary ?? 0,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMonthEntry, currentWorkspaceId, memberId, memberName],
  );

  function handleCloseSalaryModal() {
    setSetSalaryOpen(false);
    setPassbookImage(null);
    setQrCodeImage(null);
    setPaymentMethod(undefined);
    setSameAsEmployeeName(false);
    setSalaryMode('monthly');
    setSalaryForm.resetFields();
  }

  async function handleSetSalarySubmit(
    vals: {
      baseSalary: number;
      preferredPayoutMethod?: string;
      upiId?: string;
      bankName?: string;
      accountHolderName?: string;
      accountNumber?: string;
      ifscCode?: string;
      hourlyRate?: number;
      dailyHours?: number;
      finalMonthlyOverride?: number;
      salaryDayBasis?: 'fixed_month_days' | 'calendar_month_days';
      fixedMonthDays?: number | null;
      attendancePayMode?: 'default' | 'enabled' | 'disabled';
    },
    meta: {
      ctcAmount: number | null;
      selectedTemplateId: string | null;
      componentOverrides: EmployeeComponentOverride[];
    },
  ) {
    if (!currentWorkspaceId) return;

    const payrollConfig = usePayrollConfigStore.getState().config;
    const configWorkingDays = payrollConfig?.display?.defaultWorkingDays ?? 26;

    const salaryDayBasis: 'fixed_month_days' | 'calendar_month_days' =
      vals.salaryDayBasis === 'calendar_month_days' ? 'calendar_month_days' : 'fixed_month_days';

    const normalizedFixedMonthDays =
      salaryDayBasis === 'fixed_month_days'
        ? Math.max(
            1,
            Math.min(31, Number(vals.fixedMonthDays ?? configWorkingDays) || configWorkingDays),
          )
        : null;

    const monthLength = dayjs().daysInMonth();
    const resolvedBasisDays =
      salaryDayBasis === 'calendar_month_days'
        ? monthLength
        : (normalizedFixedMonthDays ?? configWorkingDays);

    const attendancePayMode: 'default' | 'enabled' | 'disabled' =
      vals.attendancePayMode === 'enabled' || vals.attendancePayMode === 'disabled'
        ? vals.attendancePayMode
        : 'default';

    let finalSalary = vals.baseSalary;
    if (salaryMode === 'hourly' && vals.hourlyRate && vals.dailyHours) {
      finalSalary =
        vals.finalMonthlyOverride && vals.finalMonthlyOverride > 0
          ? vals.finalMonthlyOverride
          : vals.hourlyRate * vals.dailyHours * resolvedBasisDays;
    }

    let passbookImageUrl: string | undefined;
    if (passbookImage) {
      if (passbookImage instanceof File) {
        const { uploadService } = await import('@/lib/services/upload.service');
        const uploaded = await uploadService.uploadSingle(passbookImage, { category: 'proofs' });
        passbookImageUrl = uploaded.url;
      } else {
        passbookImageUrl = passbookImage;
      }
    }

    let qrCodeImageUrl: string | undefined;
    if (qrCodeImage) {
      if (qrCodeImage instanceof File) {
        const { uploadService } = await import('@/lib/services/upload.service');
        const uploaded = await uploadService.uploadSingle(qrCodeImage, { category: 'proofs' });
        qrCodeImageUrl = uploaded.url;
      } else {
        qrCodeImageUrl = qrCodeImage;
      }
    }

    const accountHolder = sameAsEmployeeName ? memberName : (vals.accountHolderName ?? '');

    const commonConfig = {
      salaryDayBasis,
      attendancePayMode,
      ...(salaryDayBasis === 'fixed_month_days'
        ? { fixedMonthDays: normalizedFixedMonthDays }
        : {}),
      ...(vals.preferredPayoutMethod
        ? { preferredMethod: vals.preferredPayoutMethod as 'BANK' | 'UPI' }
        : {}),
      ...(paymentMethod === 'UPI' && vals.upiId
        ? { upiDetails: { upiId: vals.upiId, qrCodeUrl: qrCodeImageUrl } }
        : {}),
      ...(paymentMethod === 'BANK' && vals.bankName
        ? {
            bankDetails: {
              bankName: vals.bankName,
              accountHolderName: accountHolder,
              accountNumber: vals.accountNumber ?? '',
              ifscCode: vals.ifscCode ?? '',
              passbookImageUrl,
            },
          }
        : {}),
    };

    const salaryConfig =
      salaryMode === 'hourly'
        ? ({
            salaryAmount: vals.hourlyRate ?? 0,
            salaryType: 'hourly' as const,
            finalMonthlyOverride: vals.finalMonthlyOverride ?? null,
            ...(vals.dailyHours !== undefined ? { dailyHours: vals.dailyHours } : {}),
            ...commonConfig,
          } as const)
        : ({
            salaryAmount: vals.baseSalary,
            salaryType: 'monthly' as const,
            ctcAmount: meta.ctcAmount ?? null,
            componentTemplateId: meta.selectedTemplateId ?? null,
            componentOverrides: meta.componentOverrides ?? [],
            ...commonConfig,
          } as const);

    const salaryRecordUpdate = syntheticRecord._id
      ? { salaryId: syntheticRecord._id, baseSalary: finalSalary }
      : undefined;

    const isSalaryNotSet = deriveRecordStatus(syntheticRecord) === 'salary_not_set';

    setSaving(true);
    try {
      await setBasePay(currentWorkspaceId, memberId, salaryConfig, salaryRecordUpdate);
    } catch (err) {
      setSaving(false);
      msgApi.error(parseApiError(err));
      return;
    }

    msgApi.success(
      isSalaryNotSet
        ? t('salaryWorkspace.summary.setSalarySuccess')
        : t('salaryWorkspace.summary.updateSalarySuccess'),
    );
    setSaving(false);
    handleCloseSalaryModal();
    onChanged?.();
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (ledgerLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (!ledger) {
    return <div className="py-8 text-center text-sm text-faint">{t('salaryTab.summaryEmpty')}</div>;
  }

  const dash = '-';
  const hasCurrentMonth = currentMonthEntry !== null;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={t('salaryTab.kpiNetThisMonth')}
            value={hasCurrentMonth ? fmt(netThisMonth) : dash}
            emphasis
          />
          <StatTile
            label={t('salaryTab.kpiPaidThisMonth')}
            value={hasCurrentMonth ? fmt(paidThisMonth) : dash}
          />
          <StatTile
            label={t('salaryTab.kpiOutstanding')}
            value={hasCurrentMonth ? fmt(outstanding) : dash}
            tone={outstanding > 0 ? 'danger' : 'neutral'}
          />
          <StatTile
            label={t('salaryTab.kpiYtdPaid')}
            value={fmt(ytdPaid)}
            hint={t('salaryTab.kpiYtdPaidHint')}
          />
          {typeof advancesOutstanding === 'number' && advancesOutstanding > 0 && (
            <StatTile
              label={t('overview.kpiAdvances')}
              value={fmt(advancesOutstanding)}
              tone="danger"
            />
          )}
          {typeof loanOutstanding === 'number' && loanOutstanding > 0 && (
            <StatTile
              label={t('overview.kpiLoanBalance')}
              value={fmt(loanOutstanding)}
              tone="danger"
            />
          )}
        </div>

        {/* Quick actions (shown only when canAct) */}
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Button icon={<EditOutlined />} onClick={() => setSetSalaryOpen(true)} size="small">
              {t('salaryWorkspace.summary.setSalary')}
            </Button>
          </div>
        )}
      </div>

      {/* SetSalaryModal is mounted here and owned by SummarySection */}
      <SetSalaryModal
        key={setSalaryOpen ? 'open' : 'closed'}
        open={setSalaryOpen}
        record={syntheticRecord}
        form={setSalaryForm}
        saving={saving}
        salaryMode={salaryMode}
        setSalaryMode={setSalaryMode}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        passbookImage={passbookImage}
        setPassbookImage={setPassbookImage}
        qrCodeImage={qrCodeImage}
        setQrCodeImage={setQrCodeImage}
        sameAsEmployeeName={sameAsEmployeeName}
        setSameAsEmployeeName={setSameAsEmployeeName}
        onClose={handleCloseSalaryModal}
        onSubmit={handleSetSalarySubmit}
        getRecordStatus={deriveRecordStatus}
      />
    </>
  );
}
