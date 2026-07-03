'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Row,
  Col,
  Tooltip,
  Button,
  Checkbox,
  Alert,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import {
  BankOutlined,
  MobileOutlined,
  WalletOutlined,
  AuditOutlined,
  InfoCircleOutlined,
  LockOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { DsDrawer, SegmentedToggle, FileUpload, DsAvatar, DsTag } from '@/components/ui';
import type {
  SalaryRecord,
  RecordSalaryPaymentPayload,
  TeamMember,
  AdvanceComplianceBreach,
  AdvanceComplianceWarning,
} from '../../types/salary-page.types';
import { AdvanceTargetSelector } from './AdvanceTargetSelector';
import {
  AdvanceInstallmentConfigurator,
  type AdvanceInstallmentValue,
} from './AdvanceInstallmentConfigurator';
import { ComplianceOverrideModal } from './ComplianceOverrideModal';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { formatIndianAmountInput, parseAmountInput } from '@/lib/format/indian-amount';
// COA cash/bank account picker (D-06/D-10).
// listCoaAccounts → GET /workspaces/:wsId/salary/coa-accounts (Plan 26-04).
import { listCoaAccounts } from '@/lib/api/modules/salary.api';
import type { CoaAccountOption } from '@/types';

const { TextArea } = Input;

interface SplitPayment {
  id?: string;
  amount: number;
  method: string;
  transactionId?: string;
  referenceNo?: string;
  voucherNo?: string;
  paymentFrom?: string;
  paidBy?: string;
  payoutDate?: string;
  note?: string;
  proofFiles?: File[];
  internalNotes?: string;
  upiId?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiDebitedAccount?: { bankName: string; accountNumber: string };
  bankFromAccount?: { bankName: string; accountNumber: string };
}

interface PayDrawerProps {
  open: boolean;
  record: SalaryRecord | null;
  form: FormInstance;
  saving: boolean;
  dueAmount: number;
  advancePaidAmount: number;
  outstandingAdvance?: {
    outstanding: number;
    totalAdvanced: number;
    totalRecovered: number;
  } | null;
  payPreferredMethod: string | null;
  splitMode: 'single' | 'split';
  setSplitMode: (v: 'single' | 'split') => void;
  canSplit: boolean;
  splits: SplitPayment[];
  setSplits: (v: any[]) => void;
  sameDateForAll: boolean;
  setSameDateForAll: (v: boolean) => void;
  samePaidByForAll: boolean;
  setSamePaidByForAll: (v: boolean) => void;
  sameNotesForAll: boolean;
  setSameNotesForAll: (v: boolean) => void;
  singlePaymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  setSinglePaymentMethod: (v: 'cash' | 'upi' | 'bank_transfer' | 'cheque') => void;
  addCommission: boolean;
  setAddCommission: (v: boolean) => void;
  commissionAmount: number;
  setCommissionAmount: (v: number) => void;
  commissionNote: string;
  setCommissionNote: (v: string) => void;
  commissionTitle: string;
  setCommissionTitle: (v: string) => void;
  advanceTarget: 'next_month' | 'this_month';
  setAdvanceTarget: (v: 'next_month' | 'this_month') => void;
  canAdvance: boolean;
  advanceInstallmentValue: AdvanceInstallmentValue | null;
  setAdvanceInstallmentValue: (v: AdvanceInstallmentValue | null) => void;
  proofImages: (string | File)[];
  setProofImages: (v: any[]) => void;
  currentWorkspace: unknown | null;
  setCreateBankAccountOpen: (v: boolean) => void;
  onClose: () => void;
  onSubmit: (vals: {
    amount?: number;
    paymentDate?: dayjs.Dayjs;
    note?: string;
    transactionId?: string;
    voucherNo?: string;
    referenceNo?: string;
    paymentFrom?: string;
    paidBy?: string;
  }) => void;
  totalSplitAmount: number;
  projectedCurrentMonthExcess: number;
  getSalaryBasisMeta: (member: any) => { label: string; detail: string } | null;
  formatCurrencyFull: (amount: number) => string;
  formatPayrollDayValue: (value: number) => string;
  msgApi: { success: (msg: string) => void; error: (msg: string) => void };
  /** Called when the user clicks "Manage plan" on the advance recovery banner. */
  onManagePlan?: () => void;
  /**
   * Latest compliance result from the preview (set by AdvanceInstallmentConfigurator
   * via the onComplianceResult callback). When breaches exist and the user attempts
   * to submit, the override modal is shown instead of submitting directly.
   */
  latestComplianceResult?: {
    breaches: AdvanceComplianceBreach[];
    warnings: AdvanceComplianceWarning[];
  } | null;
  /**
   * Called when the user confirms the compliance override modal.
   * The parent should re-submit the payment with overrideCompliance=true
   * and the supplied reason.
   */
  onComplianceOverride?: (reason: string) => void;
  /**
   * Workspace ID used to load the COA cash/bank account picker (D-06/D-10).
   * Required for the picker to function; if empty, the picker is skipped.
   */
  workspaceId: string;
  /**
   * Called whenever the selected COA account changes so the parent can
   * forward coaAccountId to the payment payload (Plan 26-04 ledger posting).
   */
  onCoaAccountChange?: (accountId: string | undefined) => void;
}

export function PayDrawer({
  open,
  record,
  form,
  saving,
  dueAmount,
  advancePaidAmount,
  outstandingAdvance,
  payPreferredMethod,
  splitMode,
  setSplitMode,
  canSplit,
  splits,
  setSplits,
  sameDateForAll,
  samePaidByForAll,
  sameNotesForAll,
  singlePaymentMethod,
  setSinglePaymentMethod,
  addCommission,
  setAddCommission,
  commissionAmount,
  setCommissionAmount,
  commissionNote,
  setCommissionNote,
  commissionTitle,
  setCommissionTitle,
  advanceTarget,
  setAdvanceTarget,
  canAdvance,
  advanceInstallmentValue,
  setAdvanceInstallmentValue,
  proofImages,
  setProofImages,
  currentWorkspace,
  setCreateBankAccountOpen,
  onClose,
  onSubmit,
  totalSplitAmount,
  projectedCurrentMonthExcess,
  getSalaryBasisMeta,
  formatCurrencyFull,
  formatPayrollDayValue,
  msgApi,
  onManagePlan,
  latestComplianceResult,
  onComplianceOverride,
  workspaceId,
  onCoaAccountChange,
}: PayDrawerProps) {
  const t = useTranslations();
  const PAYMENT_METHODS = [
    { value: 'upi', label: t('salary.payDrawer.method.upi'), icon: <MobileOutlined /> },
    { value: 'bank_transfer', label: t('salary.payDrawer.method.bank'), icon: <BankOutlined /> },
    { value: 'cash', label: t('salary.payDrawer.method.cash'), icon: <WalletOutlined /> },
    { value: 'cheque', label: t('salary.payDrawer.method.cheque'), icon: <AuditOutlined /> },
  ];
  const [internalNotes, setInternalNotes] = useState('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [localComplianceResult, setLocalComplianceResult] = useState<{
    breaches: AdvanceComplianceBreach[];
    warnings: AdvanceComplianceWarning[];
  } | null>(null);

  // D-06/D-10: COA cash/bank account picker state.
  // Loaded from GET /workspaces/:wsId/salary/coa-accounts (Plan 26-04).
  // financeConfigured=false → show banner instead of picker; payment still proceeds (D-07).
  const [coaAccounts, setCoaAccounts] = useState<CoaAccountOption[]>([]);
  const [financeConfigured, setFinanceConfigured] = useState<boolean>(true);
  const [lastUsedCoaAccountId, setLastUsedCoaAccountId] = useState<string | null>(null);
  const [selectedCoaAccountId, setSelectedCoaAccountId] = useState<string | undefined>(undefined);
  const [coaLoading, setCoaLoading] = useState(false);

  // Load COA accounts whenever the drawer opens (workspaceId is always available).
  // Cross-module: listCoaAccounts → salary.api.ts → Plan 26-04 GET endpoint.
  useEffect(() => {
    if (!open || !workspaceId) return;
    setCoaLoading(true);
    listCoaAccounts(workspaceId)
      .then((res) => {
        setCoaAccounts(res.accounts);
        setFinanceConfigured(res.financeConfigured);
        setLastUsedCoaAccountId(res.lastUsedCoaAccountId);
        // D-10: default to last-used account; fall back to first account in list.
        const defaultId =
          res.lastUsedCoaAccountId ??
          (res.accounts.length > 0 ? res.accounts[0].accountId : undefined);
        setSelectedCoaAccountId(defaultId ?? undefined);
        onCoaAccountChange?.(defaultId ?? undefined);
      })
      .catch(() => {
        // Finance module not available or network error - treat as unconfigured (D-07).
        setFinanceConfigured(false);
        setCoaAccounts([]);
      })
      .finally(() => setCoaLoading(false));
    // Re-run only when the drawer opens or workspaceId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  // Merge locally-tracked compliance result with any prop-provided result
  // (prop takes precedence for race-condition scenarios: stale preview vs. submit error).
  const activeComplianceResult = latestComplianceResult ?? localComplianceResult;

  // Intercept the OK button: open the override modal when breaches exist,
  // otherwise fall through to normal form submission.
  // NOTE: hasComplianceBreaches is computed after showInstallmentConfigurator is declared below.
  const handleOkClick = useCallback(() => {
    // We use a ref-like check here: the modal only opens when the configurator is visible
    // and there are breaches. This is evaluated at call time so it sees current state.
    const breachCount = activeComplianceResult?.breaches?.length ?? 0;
    // surplusAmount and advanceTarget are in scope via closure.
    const configuratorVisible =
      Math.max(0, projectedCurrentMonthExcess) > 0 && advanceTarget === 'next_month';
    if (configuratorVisible && breachCount > 0) {
      setOverrideModalOpen(true);
    } else {
      form.submit();
    }
  }, [activeComplianceResult, projectedCurrentMonthExcess, advanceTarget, form]);

  const handleOverrideConfirm = useCallback(
    (reason: string) => {
      setOverrideModalOpen(false);
      onComplianceOverride?.(reason);
    },
    [onComplianceOverride],
  );

  const handleOverrideCancel = useCallback(() => {
    setOverrideModalOpen(false);
  }, []);

  const handleComplianceResult = useCallback(
    (
      result: { breaches: AdvanceComplianceBreach[]; warnings: AdvanceComplianceWarning[] } | null,
    ) => {
      setLocalComplianceResult(result);
    },
    [],
  );

  const sameDate = sameDateForAll;
  const samePaidBy = samePaidByForAll;
  const currencyFmt = useCurrencyFormatter();
  const amountValue = Form.useWatch('amount', form);

  // Unified feature access
  const features = useSalaryFeatures();
  const showCommission = features.commissionTracking.visible;
  const showProofAttachments = features.proofAttachments.visible;
  const showAttendance = features.attendanceBasedPay.visible;

  const isFullyPaid =
    (record?.paidAmount ?? 0) >= (record?.netSalary ?? 0) && (record?.netSalary ?? 0) > 0;
  // Commission-only mode: fully paid + user has checked "Add commission"
  // In this mode the salary amount is 0; only the commission is being disbursed.
  const commissionOnlyMode = isFullyPaid && addCommission;

  // surplusAmount: how much the entered amount exceeds what is still due.
  // This drives all advance-routing visibility, replacing the old isFullyPaid gates.
  const surplusAmount = Math.max(0, projectedCurrentMonthExcess);

  // Show the installment configurator whenever there is a surplus and the user has
  // chosen to advance for next month. Removed: old isFullyPaid, !addCommission,
  // and > netSalary threshold gates.
  const showInstallmentConfigurator = surplusAmount > 0 && advanceTarget === 'next_month';

  // Whether the current advance config has blocking compliance breaches.
  const hasComplianceBreaches =
    showInstallmentConfigurator && (activeComplianceResult?.breaches?.length ?? 0) > 0;

  // Next month after this salary record's month/year
  const nextMonthDayjs = record
    ? dayjs(`${record.year}-${String(record.month).padStart(2, '0')}-01`).add(1, 'month')
    : null;
  const installmentStartMonth = nextMonthDayjs ? nextMonthDayjs.month() + 1 : 1;
  const installmentStartYear = nextMonthDayjs ? nextMonthDayjs.year() : new Date().getFullYear();
  const teamMemberId =
    record?.teamMemberId != null
      ? typeof record.teamMemberId === 'string'
        ? record.teamMemberId
        : (record.teamMemberId as { _id?: string })?._id
      : undefined;
  const showAdjustmentGuidance = dueAmount > 0 && !commissionOnlyMode;
  const roundAmount = (value: number) => Math.round(value * 100) / 100;
  const quickAmountOptions =
    dueAmount > 0
      ? [
          { label: t('salary.payDrawer.amount.fullDue'), value: roundAmount(dueAmount) },
          { label: '25%', value: roundAmount(dueAmount * 0.25) },
          { label: '50%', value: roundAmount(dueAmount * 0.5) },
        ]
      : [];
  const normalizedAmountValue =
    typeof amountValue === 'number' && Number.isFinite(amountValue)
      ? roundAmount(amountValue)
      : null;
  const isQuickAmountActive = (value: number) =>
    normalizedAmountValue !== null && normalizedAmountValue === value;
  const remainingBalance =
    normalizedAmountValue !== null && normalizedAmountValue < dueAmount
      ? roundAmount(dueAmount - normalizedAmountValue)
      : 0;
  const showRemainingBalance =
    dueAmount > 0 && normalizedAmountValue !== null && normalizedAmountValue < dueAmount;
  const primarySummaryCards = [
    {
      key: 'net',
      label: t('salary.payDrawer.summary.netPay'),
      value: formatCurrencyFull(record?.netSalary ?? 0),
      background: 'var(--cr-bg)',
      border: 'var(--cr-border)',
      valueClassName: 'text-heading',
      labelClassName: 'text-muted',
    },
    {
      key: 'due',
      label: t('salary.payDrawer.summary.amountDue'),
      value: formatCurrencyFull(dueAmount),
      background: 'var(--cr-info-50)',
      border: 'var(--cr-primary-border)',
      valueClassName: 'text-blue-700',
      labelClassName: 'text-blue-700',
    },
    ...(payPreferredMethod
      ? [
          {
            key: 'preferred',
            label: t('salary.payDrawer.summary.preferred'),
            value:
              payPreferredMethod === 'BANK'
                ? t('salary.payDrawer.summary.preferredBank')
                : t('salary.payDrawer.summary.preferredUpi'),
            background: 'var(--cr-success-50)',
            border: 'var(--cr-success-50)',
            valueClassName: 'text-green-700',
            labelClassName: 'text-green-700',
          },
        ]
      : []),
    ...(record?.teamMember && getSalaryBasisMeta(record.teamMember)
      ? [
          {
            key: 'basis',
            label: t('salary.payDrawer.summary.salaryBasis'),
            value: getSalaryBasisMeta(record.teamMember)?.label ?? '',
            background: 'var(--cr-indigo-50)',
            border: 'var(--cr-indigo-100)',
            valueClassName: 'text-purple-700',
            labelClassName: 'text-purple-700',
            tooltip: getSalaryBasisMeta(record.teamMember)?.detail,
          },
        ]
      : []),
  ];
  const contextualSummaryCards = [
    ...(advancePaidAmount > 0
      ? [
          {
            key: 'overpaid',
            label: t('salary.payDrawer.summary.overpaid'),
            value: formatCurrencyFull(advancePaidAmount),
            background: 'var(--cr-warning-50)',
            border: 'var(--cr-warning-500)',
            valueClassName: 'text-amber-700',
            labelClassName: 'text-amber-700',
          },
        ]
      : []),
    ...(outstandingAdvance && outstandingAdvance.outstanding > 0
      ? [
          {
            key: 'advanceDue',
            label: t('salary.payDrawer.summary.advanceDue'),
            value: formatCurrencyFull(outstandingAdvance.outstanding),
            background: 'var(--cr-danger-50)',
            border: 'var(--cr-danger-50)',
            valueClassName: 'text-red-700',
            labelClassName: 'text-red-700',
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (commissionOnlyMode) {
      form.setFieldsValue({ amount: 0 });
    }
  }, [commissionOnlyMode]);

  const updateSplit = (idx: number, field: string, value: unknown) => {
    const newSplits = [...splits];
    (newSplits[idx] as any)[field] = value;
    setSplits(newSplits);
  };

  const addSplit = () => {
    if (splits.length >= 5) return;
    const defaultSplit: SplitPayment = {
      amount: 0,
      method: singlePaymentMethod,
      payoutDate: dayjs().toISOString(),
      paidBy: '',
    };
    setSplits([...splits, defaultSplit]);
  };

  const removeSplit = (idx: number) => {
    const newSplits = splits.filter((_, i) => i !== idx);
    setSplits(newSplits);
  };

  return (
    <DsDrawer
      open={open}
      onClose={onClose}
      title={t('salary.payDrawer.title')}
      subtitle={
        record?.teamMember && typeof record.teamMember === 'object' && 'name' in record.teamMember
          ? record.teamMember.name
          : ''
      }
      okText={
        surplusAmount > 0 && advanceTarget === 'next_month'
          ? t('salary.okButtonPayMixed', {
              amount: formatCurrencyFull(
                (typeof amountValue === 'number' && Number.isFinite(amountValue)
                  ? amountValue
                  : 0) + (addCommission && commissionAmount > 0 ? commissionAmount : 0),
              ),
            })
          : t('salary.payDrawer.okText')
      }
      okLoading={saving}
      onOk={handleOkClick}
    >
      <div className="px-5">
        <div className="mt-4">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {primarySummaryCards.map((card) => {
              const content = (
                <div
                  key={card.key}
                  className="min-h-[68px] min-w-0 rounded-xl p-2.5"
                  style={{ background: card.background, border: `1px solid ${card.border}` }}
                >
                  <p
                    className={`m-0 text-[10px] font-semibold tracking-[0.16em] uppercase ${card.labelClassName}`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`m-0 mt-1 text-[15px] leading-tight font-bold ${card.valueClassName}`}
                  >
                    {card.value}
                  </p>
                </div>
              );

              return card.tooltip ? (
                <Tooltip key={card.key} title={card.tooltip}>
                  {content}
                </Tooltip>
              ) : (
                content
              );
            })}
          </div>

          {contextualSummaryCards.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {contextualSummaryCards.map((card) => (
                <div
                  key={card.key}
                  className="min-h-[68px] min-w-0 rounded-xl p-2.5"
                  style={{ background: card.background, border: `1px solid ${card.border}` }}
                >
                  <p
                    className={`m-0 text-[10px] font-semibold tracking-[0.16em] uppercase ${card.labelClassName}`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`m-0 mt-1 text-[15px] leading-tight font-bold ${card.valueClassName}`}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!!record?.advanceRecovery?.amount && (
            <div
              className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3"
              style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-neutral-300)' }}
            >
              <InfoCircleOutlined
                style={{ color: 'var(--cr-info-700)', fontSize: 14, marginTop: 2 }}
              />
              <div className="flex-1">
                <p className="m-0 text-[12px] font-semibold text-heading">
                  {t('salary.payDrawer.advanceRecovery.title')}
                </p>
                <p className="m-0 text-[12px] text-muted">
                  {t('salary.payDrawer.advanceRecovery.body', {
                    amount: formatCurrencyFull(record.advanceRecovery.amount),
                  })}
                </p>
                {onManagePlan && (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: '2px 0', fontSize: 12, height: 'auto' }}
                    onClick={onManagePlan}
                  >
                    {t('salary.advancePlan.managePlanLink')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {showAttendance && (
            <div
              className="mb-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5"
              style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
            >
              <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                {t('salary.payDrawer.attendance.label')}
              </span>
              {!record?._id ? (
                <span className="text-[12px] font-medium text-muted">
                  {t('salary.payDrawer.attendance.notGenerated')}
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
                    style={{ background: 'var(--cr-success-50)', color: 'var(--cr-success-700)' }}
                  >
                    <span>{t('salary.payDrawer.attendance.credited')}</span>
                    <span className="font-bold">
                      {formatPayrollDayValue(record?.presentDays ?? 0)}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
                    style={{ background: 'var(--cr-danger-50)', color: 'var(--cr-danger-700)' }}
                  >
                    <span>{t('salary.payDrawer.attendance.remaining')}</span>
                    <span className="font-bold">
                      {formatPayrollDayValue(
                        Math.max(0, (record?.totalDays ?? 0) - (record?.presentDays ?? 0)),
                      )}
                    </span>
                  </span>
                  <span className="ml-1 text-[12px] font-medium text-muted">
                    {t('salary.payDrawer.attendance.payableDays', {
                      days: formatPayrollDayValue(record?.totalDays),
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {(record?.teamMember as { upiDetails?: { qrCodeUrl?: string; upiId?: string } })
            ?.upiDetails?.qrCodeUrl && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <Image
                src={
                  (record?.teamMember as { upiDetails?: { qrCodeUrl?: string } })?.upiDetails
                    ?.qrCodeUrl ?? ''
                }
                alt={t('salary.payDrawer.upi.qrAlt')}
                width={64}
                height={64}
                style={{ objectFit: 'contain' }}
                className="h-16 w-16"
              />
              <div className="flex-1">
                <p className="m-0 text-[13px] font-semibold text-heading">
                  {t('salary.payDrawer.upi.available')}
                </p>
                <p className="m-0 text-[12px] text-muted">
                  {(record?.teamMember as { upiDetails?: { upiId?: string } })?.upiDetails?.upiId}
                </p>
              </div>
            </div>
          )}

          {record?.teamMember &&
            typeof record.teamMember === 'object' &&
            !(record.teamMember as { upiDetails?: unknown }).upiDetails && (
              <p className="mb-4 text-sm text-neutral-400">{t('salary.sensitiveHidden')}</p>
            )}

          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <div className="mb-4">
              <SegmentedToggle
                sectionLabel={t('salary.payDrawer.paymentType.sectionLabel')}
                options={[
                  { value: 'single', label: t('salary.payDrawer.paymentType.single') },
                  { value: 'split', label: t('salary.payDrawer.paymentType.split') },
                ]}
                value={splitMode}
                onChange={(val) => setSplitMode(val as 'single' | 'split')}
              />
              {!canSplit && splitMode === 'split' && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                  <LockOutlined /> {t('salary.payDrawer.paymentType.splitUpgradeRequired')}
                </div>
              )}
            </div>

            {splitMode === 'single' ? (
              <>
                {!commissionOnlyMode && (dueAmount > 0 || isFullyPaid) && (
                  <>
                    <div
                      className="mb-4 rounded-2xl p-3"
                      style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
                          {t('salary.payDrawer.amount.sectionLabel')}
                        </p>
                        {dueAmount > 0 && (
                          <div
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                            style={{
                              background: 'var(--cr-info-50)',
                              border: '1px solid var(--cr-primary-border)',
                            }}
                          >
                            <span className="text-[10px] font-semibold tracking-[0.18em] text-blue-700 uppercase">
                              {t('salary.payDrawer.amount.dueNow')}
                            </span>
                            <span className="text-[14px] font-bold text-blue-700">
                              {formatCurrencyFull(dueAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                      <Form.Item
                        name="amount"
                        rules={[
                          { required: true, message: t('salary.payDrawer.amount.enterAmount') },
                        ]}
                        style={{ marginBottom: dueAmount > 0 ? 10 : 0 }}
                      >
                        <InputNumber
                          className="w-full [&_.ant-input-number-affix-wrapper]:rounded-[20px] [&_.ant-input-number-affix-wrapper]:border-slate-200 [&_.ant-input-number-affix-wrapper]:bg-white [&_.ant-input-number-affix-wrapper]:px-5 [&_.ant-input-number-affix-wrapper]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] [&_.ant-input-number-input]:h-[64px] [&_.ant-input-number-input]:text-[32px] [&_.ant-input-number-input]:font-bold [&_.ant-input-number-input]:tracking-tight [&_.ant-input-number-input]:text-slate-900 [&_.ant-input-number-prefix]:mr-3 [&_.ant-input-number-prefix]:text-[30px] [&_.ant-input-number-prefix]:font-semibold [&_.ant-input-number-prefix]:text-faint"
                          min={0}
                          controls={false}
                          formatter={(value) => formatIndianAmountInput(value)}
                          parser={parseAmountInput}
                          prefix={
                            <span className="font-medium text-faint">{currencyFmt.symbol}</span>
                          }
                          placeholder={t('salary.payDrawer.amount.placeholder')}
                          size="large"
                          style={{ width: '100%', height: 64 }}
                        />
                      </Form.Item>
                      <div
                        className={`overflow-hidden text-[12px] text-slate-600 transition-all duration-200 ${
                          showRemainingBalance ? 'mb-2 max-h-8 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        {showRemainingBalance && (
                          <span>
                            {t('salary.payDrawer.amount.remainingBalance')}{' '}
                            <span className="font-semibold text-slate-700">
                              {formatCurrencyFull(remainingBalance)}
                            </span>
                          </span>
                        )}
                      </div>
                      {dueAmount > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
                            {t('salary.payDrawer.amount.quickFill')}
                          </span>
                          {quickAmountOptions.map((option) => {
                            const active = isQuickAmountActive(option.value);
                            return (
                              <Button
                                key={option.label}
                                size="middle"
                                shape="round"
                                onClick={() => form.setFieldsValue({ amount: option.value })}
                                style={{
                                  width: 96,
                                  height: 52,
                                  paddingInline: 12,
                                  borderWidth: active ? 2 : 1,
                                  borderColor: active
                                    ? 'var(--cr-info-700)'
                                    : 'var(--cr-primary-border)',
                                  background: active ? 'var(--cr-info-50)' : 'var(--cr-surface)',
                                  color: active ? 'var(--cr-info-700)' : 'var(--cr-info-700)',
                                  fontWeight: 600,
                                  borderRadius: 16,
                                  boxShadow: active
                                    ? 'inset 0 0 0 1px rgba(147,197,253,0.6)'
                                    : 'none',
                                }}
                              >
                                <span className="flex flex-col items-center justify-center leading-none">
                                  <span className="text-[13px] font-semibold text-current">
                                    {option.label}
                                  </span>
                                  <span className="mt-1 text-[10px] font-medium text-slate-600">
                                    {currencyFmt.symbol}
                                    {formatIndianAmountInput(option.value)}
                                  </span>
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {showAdjustmentGuidance && (
                      <div
                        className="mb-4 rounded-lg px-3 py-2 text-[12px]"
                        style={{
                          background: 'var(--cr-bg)',
                          border: '1px solid var(--cr-border)',
                          color: 'var(--cr-text-4)',
                        }}
                      >
                        {t('salary.payDrawer.adjustmentGuidance')}
                      </div>
                    )}
                  </>
                )}

                {showCommission && (
                  <>
                    <Form.Item name="addCommission" valuePropName="checked">
                      <Checkbox
                        checked={addCommission}
                        onChange={(e) => setAddCommission(e.target.checked)}
                      >
                        {t('salary.payDrawer.commission.addCheckbox')}
                      </Checkbox>
                    </Form.Item>
                    {addCommission && (
                      <>
                        {commissionOnlyMode && (
                          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
                            {t('salary.payDrawer.commission.fullySettledNote')}
                          </div>
                        )}
                        <Row gutter={12} className="mb-2">
                          <Col span={10}>
                            <Form.Item label={t('salary.payDrawer.commission.amountLabel')}>
                              <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                prefix={currencyFmt.symbol}
                                value={commissionAmount}
                                onChange={(v) => setCommissionAmount(v ?? 0)}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={14}>
                            <Form.Item
                              label={t('salary.payDrawer.commission.reasonLabel')}
                              tooltip={t('salary.payDrawer.commission.reasonTooltip')}
                            >
                              <Input
                                value={commissionTitle}
                                onChange={(e) => setCommissionTitle(e.target.value)}
                                placeholder={t('salary.payDrawer.commission.reasonPlaceholder')}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={12} className="mb-4">
                          <Col span={24}>
                            <Form.Item label={t('salary.payDrawer.commission.noteLabel')}>
                              <Input
                                value={commissionNote}
                                onChange={(e) => setCommissionNote(e.target.value)}
                                placeholder={t('salary.payDrawer.commission.notePlaceholder')}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </>
                    )}
                  </>
                )}

                {surplusAmount > 0 && (
                  <div className="mb-4">
                    <div
                      className="mb-3 overflow-hidden rounded-xl"
                      style={{ border: '1px solid var(--cr-indigo-100)' }}
                    >
                      <div className="px-3.5 py-2" style={{ background: 'var(--cr-indigo-50)' }}>
                        <p className="m-0 text-[11px] font-semibold tracking-[0.16em] text-purple-700 uppercase">
                          {t('salary.payDrawer.moneyBreakdown.title')}
                        </p>
                      </div>
                      <div
                        className="flex flex-col gap-1.5 px-3.5 py-3"
                        style={{ background: 'var(--cr-indigo-50)' }}
                      >
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-muted">
                            {t('salary.payDrawer.moneyBreakdown.salaryLine', {
                              month: record
                                ? dayjs(
                                    `${record.year}-${String(record.month).padStart(2, '0')}-01`,
                                  ).format('MMMM YYYY')
                                : '',
                            })}
                          </span>
                          <span className="font-semibold text-heading">
                            {formatCurrencyFull(
                              Math.min(
                                typeof amountValue === 'number' && Number.isFinite(amountValue)
                                  ? amountValue
                                  : 0,
                                dueAmount,
                              ),
                            )}
                          </span>
                        </div>
                        {addCommission && commissionAmount > 0 && (
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-muted">
                              {t('salary.payDrawer.moneyBreakdown.commissionLine', {
                                title:
                                  commissionTitle || t('salary.payDrawer.commission.addCheckbox'),
                              })}
                            </span>
                            <span className="font-semibold text-heading">
                              {formatCurrencyFull(commissionAmount)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-muted">
                            {advanceTarget === 'next_month'
                              ? t('salary.payDrawer.moneyBreakdown.advanceLineWithTarget', {
                                  month: record
                                    ? dayjs(
                                        `${record.year}-${String(record.month).padStart(2, '0')}-01`,
                                      )
                                        .add(1, 'month')
                                        .format('MMMM YYYY')
                                    : '',
                                })
                              : t('salary.payDrawer.moneyBreakdown.advanceLineThisMonth')}
                          </span>
                          <span className="font-semibold text-purple-700">
                            {formatCurrencyFull(surplusAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <AdvanceTargetSelector
                      payModal={record ? { month: record.month, year: record.year } : null}
                      advanceTarget={(advanceTarget as 'next_month' | 'this_month') ?? 'next_month'}
                      setAdvanceTarget={(v) => {
                        setAdvanceTarget(v);
                        setAdvanceInstallmentValue(null);
                      }}
                      canAdvance={canAdvance}
                    />
                    {showInstallmentConfigurator && (
                      <AdvanceInstallmentConfigurator
                        excessAmount={surplusAmount}
                        startMonth={installmentStartMonth}
                        startYear={installmentStartYear}
                        teamMemberId={teamMemberId}
                        value={advanceInstallmentValue}
                        onChange={setAdvanceInstallmentValue}
                        onComplianceResult={handleComplianceResult}
                      />
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <SegmentedToggle
                    sectionLabel={t('salary.payDrawer.method.sectionLabel')}
                    options={PAYMENT_METHODS}
                    value={singlePaymentMethod}
                    onChange={(val) => setSinglePaymentMethod(val as typeof singlePaymentMethod)}
                  />
                </div>

                {singlePaymentMethod === 'upi' && (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="transactionId"
                        label={t('salary.payDrawer.fields.transactionId')}
                      >
                        <Input
                          placeholder={t('salary.payDrawer.fields.transactionIdPlaceholder')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="paidBy" label={t('salary.payDrawer.fields.paidBy')}>
                        <Input placeholder={t('salary.payDrawer.fields.paidByPlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
                {singlePaymentMethod === 'bank_transfer' && (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="referenceNo"
                        label={t('salary.payDrawer.fields.referenceUtr')}
                      >
                        <Input placeholder={t('salary.payDrawer.fields.utrPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="paidBy" label={t('salary.payDrawer.fields.paidBy')}>
                        <Input placeholder={t('salary.payDrawer.fields.paidByPlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
                {singlePaymentMethod === 'cash' && (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="voucherNo" label={t('salary.payDrawer.fields.voucherNo')}>
                        <Input placeholder={t('salary.payDrawer.fields.voucherPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="paidBy" label={t('salary.payDrawer.fields.paidBy')}>
                        <Input placeholder={t('salary.payDrawer.fields.paidByPlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
                {singlePaymentMethod === 'cheque' && (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="referenceNo" label={t('salary.payDrawer.fields.chequeNo')}>
                        <Input placeholder={t('salary.payDrawer.fields.chequePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="voucherNo" label={t('salary.payDrawer.fields.bankName')}>
                        <Input placeholder={t('salary.payDrawer.fields.bankNamePlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}

                <Form.Item
                  name="paymentDate"
                  label={t('salary.payDrawer.fields.paymentDate')}
                  rules={[{ required: true }]}
                >
                  <DatePicker className="w-full" />
                </Form.Item>
              </>
            ) : (
              <>
                {showAdjustmentGuidance && (
                  <div
                    className="mb-4 rounded-lg px-3 py-2 text-[12px]"
                    style={{
                      background: 'var(--cr-bg)',
                      border: '1px solid var(--cr-border)',
                      color: 'var(--cr-text-4)',
                    }}
                  >
                    {t('salary.payDrawer.adjustmentGuidance')}
                  </div>
                )}
                {Math.max(0, totalSplitAmount - dueAmount) > 0 && (
                  <div className="mb-4">
                    <AdvanceTargetSelector
                      payModal={record ? { month: record.month, year: record.year } : null}
                      advanceTarget={(advanceTarget as 'next_month' | 'this_month') ?? 'next_month'}
                      setAdvanceTarget={(v) => {
                        setAdvanceTarget(v);
                        setAdvanceInstallmentValue(null);
                      }}
                      canAdvance={canAdvance}
                    />
                    {advanceTarget === 'next_month' && (
                      <AdvanceInstallmentConfigurator
                        excessAmount={Math.max(0, totalSplitAmount - dueAmount)}
                        startMonth={installmentStartMonth}
                        startYear={installmentStartYear}
                        teamMemberId={teamMemberId}
                        value={advanceInstallmentValue}
                        onChange={setAdvanceInstallmentValue}
                        onComplianceResult={handleComplianceResult}
                      />
                    )}
                  </div>
                )}

                {splits.map((split, idx) => (
                  <div
                    key={idx}
                    className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[15px] font-semibold text-slate-900">
                        {t('salary.payDrawer.split.splitN', { n: idx + 1 })}
                      </span>
                      {splits.length > 1 && (
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={t('salary.payDrawer.split.removeSplitAriaLabel', {
                            n: idx + 1,
                          })}
                          onClick={() => removeSplit(idx)}
                          className="rounded-lg border border-transparent hover:!border-red-200 hover:!bg-red-50"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.amountLabel')}>
                          <InputNumber
                            className="w-full [&_.ant-input-number-affix-wrapper]:h-[46px] [&_.ant-input-number-affix-wrapper]:rounded-xl [&_.ant-input-number-input]:text-[20px] [&_.ant-input-number-input]:font-semibold [&_.ant-input-number-prefix]:mr-2 [&_.ant-input-number-prefix]:text-base [&_.ant-input-number-prefix]:font-semibold [&_.ant-input-number-prefix]:text-faint"
                            min={0}
                            size="large"
                            formatter={(value) => formatIndianAmountInput(value)}
                            parser={parseAmountInput}
                            prefix={currencyFmt.symbol}
                            value={split.amount}
                            onChange={(v) => updateSplit(idx, 'amount', v ?? 0)}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </div>
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.methodLabel')}>
                          <Select
                            size="large"
                            value={split.method}
                            onChange={(v) => updateSplit(idx, 'method', v)}
                            options={PAYMENT_METHODS}
                          />
                        </Form.Item>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.referenceLabel')}>
                          <Input
                            size="large"
                            className="placeholder:text-slate-600"
                            value={split.referenceNo}
                            onChange={(e) => updateSplit(idx, 'referenceNo', e.target.value)}
                            placeholder={t('salary.payDrawer.split.refPlaceholder')}
                          />
                        </Form.Item>
                      </div>
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.paidByLabel')}>
                          <Input
                            size="large"
                            className="placeholder:text-slate-600"
                            value={split.paidBy}
                            onChange={(e) => updateSplit(idx, 'paidBy', e.target.value)}
                            placeholder={t('salary.payDrawer.split.paidByPlaceholder')}
                          />
                        </Form.Item>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.dateLabel')}>
                          <DatePicker
                            size="large"
                            className="w-full"
                            value={split.payoutDate ? dayjs(split.payoutDate) : null}
                            onChange={(d) =>
                              updateSplit(idx, 'payoutDate', d ? d.toISOString() : undefined)
                            }
                          />
                        </Form.Item>
                      </div>
                      <div>
                        <Form.Item label={t('salary.payDrawer.split.noteLabel')}>
                          <Input
                            size="large"
                            className="placeholder:text-slate-600"
                            value={split.note}
                            onChange={(e) => updateSplit(idx, 'note', e.target.value)}
                            placeholder={t('salary.payDrawer.split.notePlaceholder')}
                          />
                        </Form.Item>
                      </div>
                    </div>
                  </div>
                ))}

                {splits.length < 5 && (
                  <Button icon={<PlusOutlined />} onClick={addSplit} className="mb-4">
                    {t('salary.payDrawer.split.addSplit')}
                  </Button>
                )}

                <div className="mb-4 text-right font-semibold">
                  {t('salary.payDrawer.split.total')} {formatCurrencyFull(totalSplitAmount)}
                </div>

                <Form.Item
                  name="paymentDate"
                  label={t('salary.payDrawer.fields.paymentDate')}
                  rules={[{ required: true }]}
                >
                  <DatePicker className="w-full" />
                </Form.Item>
              </>
            )}

            {showProofAttachments && (
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-heading">
                  {t('salary.payDrawer.proof.attachLabel')}
                </p>
                <FileUpload
                  category="proofs"
                  value={proofImages as any}
                  onChange={(files: any) => setProofImages(files)}
                />
              </div>
            )}

            {/* D-06/D-10: COA cash/bank account picker for ledger posting.
                financeConfigured=false → show info banner; payment still proceeds without coaAccountId (D-07).
                Cross-module: selected accountId forwarded to recordPayment → Plan 26-04 SalaryLedgerPostingService. */}
            {financeConfigured ? (
              coaAccounts.length > 0 && (
                <Form.Item label="Pay from account">
                  <Select
                    loading={coaLoading}
                    value={selectedCoaAccountId}
                    onChange={(val: string) => {
                      setSelectedCoaAccountId(val);
                      onCoaAccountChange?.(val);
                    }}
                    options={coaAccounts.map((a) => ({
                      value: a.accountId,
                      label: `${a.code} - ${a.name}`,
                    }))}
                    placeholder="Select cash/bank account"
                  />
                </Form.Item>
              )
            ) : (
              <div className="mb-4">
                {/* D-07: Finance not configured - show info banner; do NOT block payment. */}
                <Alert
                  title="Set up the Finance module to enable accounting integration"
                  type="info"
                  showIcon
                />
              </div>
            )}

            <Form.Item name="note" label={t('salary.payDrawer.internalNotes.label')}>
              <TextArea
                placeholder={t('salary.payDrawer.internalNotes.placeholder')}
                rows={2}
                size="large"
              />
            </Form.Item>
          </Form>
        </div>
      </div>

      {hasComplianceBreaches && (
        <ComplianceOverrideModal
          open={overrideModalOpen}
          breaches={activeComplianceResult?.breaches ?? []}
          onConfirm={handleOverrideConfirm}
          onCancel={handleOverrideCancel}
          confirmLoading={saving}
        />
      )}
    </DsDrawer>
  );
}
