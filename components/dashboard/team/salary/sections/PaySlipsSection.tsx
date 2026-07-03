'use client';

import { useState, useCallback } from 'react';
import { Tabs, Button, Form, App } from 'antd';
import { FileSearchOutlined, RollbackOutlined } from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import type { LedgerRecord, LedgerTransaction, LedgerMonth, GratuityLedger } from '@/types';
import { formatCurrencyFull as fmtCurrFull } from '@/lib/utils';
import SalaryHistoryTab from '@/components/dashboard/team/form/SalaryHistoryTab';
import PayslipsTab from '@/components/dashboard/team/form/PayslipsTab';
import { MonthTransactionsModal } from '@/app/(app)/dashboard/salary/components/salary/MonthTransactionsModal';
import { ReversePaymentModal } from '@/app/(app)/dashboard/salary/components/salary/ReversePaymentModal';
import { PayDrawer } from '@/app/(app)/dashboard/salary/components/salary/PayDrawer';
import { useMemberMonthPay } from '@/app/(app)/dashboard/salary/hooks/useMemberMonthPay';
import { reverseSalaryPayment } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type {
  SalaryRecord,
  LedgerMonth as SalaryLedgerMonth,
} from '@/app/(app)/dashboard/salary/types/salary-page.types';

// ── Settlement meta helper (mirrors RunPayrollPage.getSettlementMeta) ─────────

function getSettlementMeta(salary: number, paid: number) {
  const remaining = salary - paid;
  if (remaining < 0) {
    return {
      statusColor: 'var(--cr-warning-700)',
      statusBg: 'var(--cr-warning-50)',
      statusLabel: 'Overpaid',
      balanceLabel: 'OVERPAID',
      balanceValue: Math.abs(remaining),
      balanceColor: 'var(--cr-warning-700)',
    };
  }
  if (paid >= salary && salary > 0) {
    return {
      statusColor: 'var(--cr-success)',
      statusBg: 'var(--cr-success-50)',
      statusLabel: 'Settled',
      balanceLabel: 'BALANCE DUE',
      balanceValue: 0,
      balanceColor: 'var(--cr-success)',
    };
  }
  if (paid > 0) {
    return {
      statusColor: 'var(--cr-warning)',
      statusBg: 'var(--cr-warning-50)',
      statusLabel: 'Partially Paid',
      balanceLabel: 'BALANCE DUE',
      balanceValue: remaining,
      balanceColor: 'var(--cr-warning)',
    };
  }
  return {
    statusColor: 'var(--cr-error)',
    statusBg: 'var(--cr-danger-50)',
    statusLabel: 'Pending',
    balanceLabel: 'BALANCE DUE',
    balanceValue: Math.max(0, remaining),
    balanceColor: 'var(--cr-error)',
  };
}

// ── Build a minimal SalaryRecord stub from a LedgerMonth ─────────────────────

function ledgerMonthToSalaryRecord(
  month: LedgerMonth,
  memberId: string,
  memberName: string,
): SalaryRecord {
  const [yearStr, monthStr] = month.monthKey.split('-');
  return {
    _id: month.salaryId || undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teamMemberId: memberId as any,
    teamMember: { id: memberId, name: memberName } as unknown as SalaryRecord['teamMember'],
    month: Number(monthStr),
    year: Number(yearStr),
    baseSalary: month.baseSalary,
    additions: month.additions,
    deductions: month.deductions,
    netSalary: month.salary,
    paidAmount: month.paid,
    status: month.status,
    isLocked: month.isLocked,
    isPreview: false,
    settlementStatus: undefined,
    advanceRecovery: undefined,
    advanceOut: undefined,
    presentDays: undefined,
    totalDays: undefined,
    effectiveSalary: month.salary,
    finalMonthlyOverride: undefined,
  } as unknown as SalaryRecord;
}

// ── Convert LedgerMonth to SalaryLedgerMonth ──────────────────────────────────

function toLedgerMonthType(m: LedgerMonth): SalaryLedgerMonth {
  return {
    salaryId: m.salaryId,
    monthKey: m.monthKey,
    monthLabel: m.monthLabel,
    salary: m.salary,
    status: m.status,
    baseSalary: m.baseSalary,
    additions: m.additions,
    deductions: m.deductions,
    isLocked: m.isLocked,
    paid: m.paid,
    remaining: m.remaining,
    // LedgerTransaction from types/index.ts is compatible enough
    transactions: m.transactions as unknown as SalaryLedgerMonth['transactions'],
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PaySlipsSectionProps {
  memberId: string;
  memberName: string;
  memberEmail?: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  /** Gratuity data forwarded to SalaryHistoryTab. */
  gratuityLedger: GratuityLedger | null;
  gratuityLoading: boolean;
  gratuityLoaded: boolean;
  canViewGratuityTracking: boolean;
  canAct: boolean;
  workspaceId: string;
  onChanged?: () => void;
}

// ── PaySlipsSection ────────────────────────────────────────────────────────────

export function PaySlipsSection({
  memberId,
  memberName,
  memberEmail,
  ledger,
  ledgerLoading,
  gratuityLedger,
  gratuityLoading,
  gratuityLoaded,
  canViewGratuityTracking,
  canAct,
  workspaceId,
  onChanged,
}: PaySlipsSectionProps) {
  const t = useTranslations('team');

  // ── Month detail modal state ─────────────────────────────────────────────────

  const [detailData, setDetailData] = useState<{
    record: SalaryRecord;
    monthData: SalaryLedgerMonth | null;
  } | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());

  const openDetail = useCallback(
    (month: LedgerMonth) => {
      const salaryRecord = ledgerMonthToSalaryRecord(month, memberId, memberName);
      setDetailData({ record: salaryRecord, monthData: toLedgerMonthType(month) });
      setExpandedSplits(new Set());
    },
    [memberId, memberName],
  );

  const closeDetail = useCallback(() => {
    setDetailData(null);
    setExpandedSplits(new Set());
  }, []);

  const toggleSplit = useCallback((id: string) => {
    setExpandedSplits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Reverse payment state ────────────────────────────────────────────────────

  const [reversePaymentForm] = Form.useForm();
  const [reverseTarget, setReverseTarget] = useState<LedgerTransaction | null>(null);
  const [reverseSaving, setReverseSaving] = useState(false);
  const { message: revMsgApi } = App.useApp();

  const handleReversePayment = useCallback(
    async (vals: { reversalReason: string }) => {
      if (!reverseTarget) return;
      setReverseSaving(true);
      try {
        await reverseSalaryPayment(workspaceId, reverseTarget.id, {
          reversalReason: vals.reversalReason.trim(),
        });
        revMsgApi.success('Payment reversed');
        setReverseTarget(null);
        reversePaymentForm.resetFields();
        onChanged?.();
      } catch (e) {
        revMsgApi.error(parseApiError(e));
      } finally {
        setReverseSaving(false);
      }
    },
    [reverseTarget, workspaceId, reversePaymentForm, revMsgApi, onChanged],
  );

  // ── PayDrawer (record payment) ───────────────────────────────────────────────

  const pay = useMemberMonthPay(workspaceId, memberId, onChanged);

  // Watch the pay amount at component body level (React hooks must not be called in JSX).
  const payAmountDraft = Number(Form.useWatch('amount', pay.payForm) ?? 0) || 0;
  const projectedCurrentMonthExcess = Math.max(0, payAmountDraft - pay.dueAmount);

  const handleRecordPayment = useCallback(
    (month: LedgerMonth) => {
      const parts = month.monthKey.split('-');
      const yearNum = Number(parts[0]);
      const monthNum = Number(parts[1]);
      void pay.openPay(monthNum, yearNum);
    },
    [pay],
  );

  // PayDrawer.onSubmit receives form values from its own internal form fields.
  // useMemberMonthPay.submitPayment reads them via payForm.getFieldsValue() internally,
  // so we wrap it to match PayDrawer's expected signature while ignoring the passed vals.
  const handlePayDrawerSubmit = useCallback(() => {
    pay.submitPayment();
  }, [pay]);

  // ── Inner tab items ──────────────────────────────────────────────────────────

  // Build an augmented SalaryHistoryTab section where each month row gets action buttons.
  // Since SalaryHistoryTab renders its own UI, we add an action overlay by using a wrapper
  // div approach: render both the read tab and an action button strip per month externally.
  // This is the cleanest extension without forking SalaryHistoryTab.

  const payTabItems = [
    {
      key: 'history',
      label: t('salaryWorkspace.pay.historyTab'),
      children: (
        <div className="flex flex-col gap-3">
          {/* Action buttons per month row - only when canAct and ledger has months */}
          {canAct && ledger && ledger.months.length > 0 && (
            <div className="flex flex-col gap-2">
              {ledger.months.map((m) => {
                const hasActiveTransactions = m.transactions.some((tx) => tx.status !== 'reversed');
                return (
                  <div
                    key={m.monthKey}
                    className="bg-surface-secondary flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <span className="font-display text-[14px] font-semibold text-primary">
                        {m.monthLabel}
                      </span>
                      <span className="ml-2 text-[12px] text-muted">
                        {dayjs(`${m.monthKey}-01`).format('YYYY')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="small"
                        icon={<FileSearchOutlined />}
                        onClick={() => openDetail(m)}
                      >
                        {t('salaryWorkspace.pay.details')}
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<RupeeOutlined />}
                        onClick={() => handleRecordPayment(m)}
                        disabled={m.isLocked}
                      >
                        {t('salaryWorkspace.pay.recordPayment')}
                      </Button>
                      {hasActiveTransactions && (
                        <Button
                          size="small"
                          danger
                          icon={<RollbackOutlined />}
                          onClick={() => {
                            const firstActive = m.transactions.find(
                              (tx) => tx.status !== 'reversed',
                            );
                            if (firstActive) {
                              // Cast: LedgerTransaction from types/index is compatible
                              setReverseTarget(firstActive as unknown as LedgerTransaction);
                            }
                          }}
                        >
                          {t('salaryWorkspace.pay.reversePayment')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Read-only history list */}
          <SalaryHistoryTab
            ledger={ledger}
            ledgerLoading={ledgerLoading}
            gratuityLedger={gratuityLedger}
            gratuityLoading={gratuityLoading}
            gratuityLoaded={gratuityLoaded}
            canViewGratuityTracking={canViewGratuityTracking}
          />
        </div>
      ),
    },
    {
      key: 'payslips',
      label: t('salaryWorkspace.pay.payslipsTab'),
      children: (
        <PayslipsTab
          memberName={memberName}
          memberEmail={memberEmail}
          ledger={ledger}
          ledgerLoading={ledgerLoading}
        />
      ),
    },
  ];

  return (
    <>
      <Tabs defaultActiveKey="history" items={payTabItems} size="small" />

      {/* Month detail / transactions modal */}
      <MonthTransactionsModal
        open={!!detailData}
        data={detailData}
        isLedgerLoading={false}
        ledgerError={null}
        expandedSplits={expandedSplits}
        canExport={false}
        exportRows={[]}
        exportFilename=""
        exportFilterSummary={undefined}
        getExportData={async () => []}
        onClose={closeDetail}
        onToggleSplit={toggleSplit}
        onOpenLedger={() => {}}
        onLoadFullLedger={() => {}}
        onShowFullHistory={() => {}}
        onSetMonthTransactionsModal={(data) => {
          if (!data) closeDetail();
        }}
        onSetReversePaymentTarget={(tx) => {
          if (tx) setReverseTarget(tx as unknown as LedgerTransaction);
        }}
        onResetReversePaymentForm={() => reversePaymentForm.resetFields()}
        getSettlementMeta={getSettlementMeta}
        formatCurrencyFull={fmtCurrFull}
      />

      {/* Reverse payment modal */}
      <ReversePaymentModal
        open={!!reverseTarget}
        transaction={
          reverseTarget as unknown as
            | import('@/app/(app)/dashboard/salary/types/salary-page.types').LedgerTransaction
            | null
        }
        form={reversePaymentForm}
        loading={reverseSaving}
        onCancel={() => {
          setReverseTarget(null);
          reversePaymentForm.resetFields();
        }}
        onSubmit={handleReversePayment}
      />

      {/* PayDrawer - record payment */}
      <PayDrawer
        workspaceId={workspaceId}
        open={pay.open}
        record={pay.record}
        form={pay.payForm}
        saving={pay.saving || pay.fetching}
        dueAmount={pay.dueAmount}
        advancePaidAmount={pay.advancePaidAmount}
        outstandingAdvance={pay.outstandingAdvance}
        payPreferredMethod={pay.payPreferredMethod ?? null}
        splitMode={pay.splitMode}
        setSplitMode={pay.setSplitMode}
        canSplit={pay.canSplit}
        splits={pay.splits}
        setSplits={pay.setSplits as (v: unknown[]) => void}
        sameDateForAll={pay.sameDateForAll}
        setSameDateForAll={pay.setSameDateForAll}
        samePaidByForAll={pay.samePaidByForAll}
        setSamePaidByForAll={pay.setSamePaidByForAll}
        sameNotesForAll={pay.sameNotesForAll}
        setSameNotesForAll={pay.setSameNotesForAll}
        singlePaymentMethod={pay.singlePaymentMethod}
        setSinglePaymentMethod={pay.setSinglePaymentMethod}
        addCommission={pay.addCommission}
        setAddCommission={pay.setAddCommission}
        commissionAmount={pay.commissionAmount}
        setCommissionAmount={pay.setCommissionAmount}
        commissionNote={pay.commissionNote}
        setCommissionNote={pay.setCommissionNote}
        commissionTitle={pay.commissionTitle}
        setCommissionTitle={pay.setCommissionTitle}
        advanceTarget={pay.advanceTarget}
        setAdvanceTarget={pay.setAdvanceTarget}
        canAdvance={pay.canAdvance}
        advanceInstallmentValue={pay.advanceInstallmentValue}
        setAdvanceInstallmentValue={pay.setAdvanceInstallmentValue}
        proofImages={pay.proofImages}
        setProofImages={pay.setProofImages as (v: unknown[]) => void}
        currentWorkspace={null}
        setCreateBankAccountOpen={() => {}}
        onClose={pay.closePay}
        onSubmit={handlePayDrawerSubmit}
        onComplianceOverride={(reason) =>
          pay.submitPayment({ overrideCompliance: true, overrideReason: reason })
        }
        latestComplianceResult={
          pay.pendingComplianceBreaches
            ? { breaches: pay.pendingComplianceBreaches, warnings: [] }
            : undefined
        }
        totalSplitAmount={pay.totalSplitAmount}
        projectedCurrentMonthExcess={projectedCurrentMonthExcess}
        getSalaryBasisMeta={pay.getSalaryBasisMeta}
        formatCurrencyFull={pay.formatCurrencyFull}
        formatPayrollDayValue={pay.formatPayrollDayValue}
        msgApi={pay.msgApi}
      />
    </>
  );
}
