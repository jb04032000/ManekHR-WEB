'use client';

import { useState, useCallback, startTransition } from 'react';
import { Form, App } from 'antd';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { ensureSalaryRecord, recordSalaryPayment } from '@/lib/actions';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { formatPayrollDayValue } from '../utils/salary-page.utils';
import type { SalaryRecord, AdvanceComplianceBreach } from '../types/salary-page.types';
import type { AdvanceInstallmentValue } from '../components/salary/AdvanceInstallmentConfigurator';

export interface SplitLine {
  id: string;
  amount: number;
  method: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  transactionId: string;
  voucherNo: string;
  referenceNo: string;
  paymentFrom: string;
  paidBy: string;
  payoutDate: string;
  proofFiles: File[];
  internalNotes: string;
}

function makeSplitLine(id: string, method: 'cash' | 'upi' | 'bank_transfer' | 'cheque'): SplitLine {
  return {
    id,
    amount: 0,
    method,
    transactionId: '',
    voucherNo: '',
    referenceNo: '',
    paymentFrom: '',
    paidBy: '',
    payoutDate: dayjs().toISOString(),
    proofFiles: [],
    internalNotes: '',
  };
}

interface UseMemberMonthPayResult {
  // open/close
  open: boolean;
  openPay: (month: number, year: number) => Promise<void>;
  closePay: () => void;

  // record being paid
  record: SalaryRecord | null;
  fetching: boolean;

  // form
  payForm: ReturnType<typeof Form.useForm>[0];

  // payment state
  saving: boolean;
  splitMode: 'single' | 'split';
  setSplitMode: (v: 'single' | 'split') => void;
  splits: SplitLine[];
  setSplits: (v: SplitLine[]) => void;
  singlePaymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  setSinglePaymentMethod: (v: 'cash' | 'upi' | 'bank_transfer' | 'cheque') => void;
  sameDateForAll: boolean;
  setSameDateForAll: (v: boolean) => void;
  samePaidByForAll: boolean;
  setSamePaidByForAll: (v: boolean) => void;
  sameNotesForAll: boolean;
  setSameNotesForAll: (v: boolean) => void;
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
  advanceInstallmentValue: AdvanceInstallmentValue | null;
  setAdvanceInstallmentValue: (v: AdvanceInstallmentValue | null) => void;
  proofImages: File[];
  setProofImages: (v: File[]) => void;
  outstandingAdvance: { outstanding: number; totalAdvanced: number; totalRecovered: number } | null;
  payPreferredMethod: 'BANK' | 'UPI' | undefined;
  pendingComplianceBreaches: AdvanceComplianceBreach[] | null;

  // derived values
  dueAmount: number;
  advancePaidAmount: number;
  totalSplitAmount: number;

  // features
  canSplit: boolean;
  canAdvance: boolean;

  // formatters
  formatCurrencyFull: (n: number) => string;
  formatPayrollDayValue: (n: number) => string;
  getSalaryBasisMeta: (member: unknown) => { label: string; detail: string } | null;

  // actions
  submitPayment: (extra?: { overrideCompliance?: boolean; overrideReason?: string }) => void;

  // app-level message api (no per-hook contextHolder to avoid duplicate message-holder keys)
  msgApi: ReturnType<typeof App.useApp>['message'];
}

/**
 * Self-contained hook that manages all state needed to open PayDrawer for a
 * single (memberId, month, year) combination. Reuses the same payment logic as
 * RunPayrollPage but scoped to one member row.
 */
export function useMemberMonthPay(
  workspaceId: string | null,
  memberId: string,
  onChanged?: () => void,
): UseMemberMonthPayResult {
  const { message: msgApi } = App.useApp();
  const [payForm] = Form.useForm();

  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const payrollDisplay = usePayrollConfigStore((s) => s.config?.display);
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;

  const features = useSalaryFeatures();
  const canSplit = features.splitPayments.enabled;
  const canAdvance = features.advancePayments.enabled;

  // open/fetch state
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [record, setRecord] = useState<SalaryRecord | null>(null);

  // payment state
  const [saving, setSaving] = useState(false);
  const [splitMode, setSplitMode] = useState<'single' | 'split'>('single');
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<
    'cash' | 'upi' | 'bank_transfer' | 'cheque'
  >('bank_transfer');
  const [splits, setSplits] = useState<SplitLine[]>([
    makeSplitLine('1', 'bank_transfer'),
    makeSplitLine('2', 'bank_transfer'),
  ]);
  const [sameDateForAll, setSameDateForAll] = useState(false);
  const [samePaidByForAll, setSamePaidByForAll] = useState(false);
  const [sameNotesForAll, setSameNotesForAll] = useState(false);
  const [addCommission, setAddCommission] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [commissionNote, setCommissionNote] = useState('');
  const [commissionTitle, setCommissionTitle] = useState('');
  const [advanceTarget, setAdvanceTarget] = useState<'next_month' | 'this_month'>('next_month');
  const [advanceInstallmentValue, setAdvanceInstallmentValue] =
    useState<AdvanceInstallmentValue | null>(null);
  const [proofImages, setProofImages] = useState<File[]>([]);
  const [outstandingAdvance, setOutstandingAdvance] = useState<{
    outstanding: number;
    totalAdvanced: number;
    totalRecovered: number;
  } | null>(null);
  const [payPreferredMethod, setPayPreferredMethod] = useState<'BANK' | 'UPI' | undefined>(
    undefined,
  );
  const [pendingComplianceBreaches, setPendingComplianceBreaches] = useState<
    AdvanceComplianceBreach[] | null
  >(null);

  const resetPayState = useCallback(
    (rec: SalaryRecord) => {
      payForm.resetFields();
      const payable = rec.isPreview
        ? (rec.effectiveSalary ?? rec.baseSalary ?? 0)
        : (rec.netSalary ?? 0);
      const dueAmt = Math.max(0, payable - (rec.paidAmount ?? 0));
      const preferred = rec.teamMember?.preferredMethod;
      const defaultMethod: 'bank_transfer' | 'upi' = preferred === 'UPI' ? 'upi' : 'bank_transfer';
      payForm.setFieldsValue({
        amount: dueAmt > 0 ? dueAmt : 0,
        paymentDate: dayjs(),
      });
      startTransition(() => {
        setSplitMode('single');
        setSplits([makeSplitLine('1', defaultMethod), makeSplitLine('2', defaultMethod)]);
        setProofImages([]);
        setPayPreferredMethod(preferred as 'BANK' | 'UPI' | undefined);
        setSinglePaymentMethod(defaultMethod);
        setSameDateForAll(false);
        setSameNotesForAll(false);
        setSamePaidByForAll(false);
        setAdvanceTarget('next_month');
        setAddCommission(false);
        setCommissionAmount(0);
        setCommissionNote('');
        setCommissionTitle('');
        setPendingComplianceBreaches(null);
      });
    },
    [payForm],
  );

  const openPay = useCallback(
    async (month: number, year: number) => {
      if (!workspaceId || !isHydrated) {
        msgApi.error('Workspace not ready');
        return;
      }
      setFetching(true);
      setOpen(true);
      try {
        const rec = await ensureSalaryRecord(workspaceId, memberId, month, year);
        setRecord(rec);
        resetPayState(rec);

        // fetch outstanding advance
        salaryApi
          .getOutstandingAdvances(workspaceId, memberId)
          .then((data) => setOutstandingAdvance(data))
          .catch(() => setOutstandingAdvance(null));
      } catch (e) {
        msgApi.error(parseApiError(e));
        setOpen(false);
      } finally {
        setFetching(false);
      }
    },
    [workspaceId, memberId, isHydrated, msgApi, resetPayState],
  );

  const closePay = useCallback(() => {
    setOpen(false);
    setRecord(null);
    setOutstandingAdvance(null);
    setPendingComplianceBreaches(null);
    payForm.resetFields();
  }, [payForm]);

  const submitPayment = useCallback(
    (extra?: { overrideCompliance?: boolean; overrideReason?: string }) => {
      if (!workspaceId || !record) {
        msgApi.error('No record selected for payment');
        return;
      }
      if (!isHydrated) {
        msgApi.error('App not ready');
        return;
      }

      const vals = payForm.getFieldsValue();

      let amount: number;
      if (splitMode === 'split') {
        amount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
        if (amount <= 0) {
          msgApi.error('Please add amounts to the split payments');
          return;
        }
      } else {
        amount = vals.amount ?? 0;
        if (amount <= 0) {
          msgApi.error('Please enter a valid amount');
          return;
        }
      }

      setSaving(true);
      void (async () => {
        try {
          const payable = record.isPreview
            ? (record.effectiveSalary ?? record.baseSalary ?? 0)
            : (record.netSalary ?? 0);
          const remainingDue = Math.max(0, payable - (record.paidAmount ?? 0));
          const localIsAdvance = amount > remainingDue;

          const paymentDate = vals.paymentDate
            ? vals.paymentDate.toISOString()
            : new Date().toISOString();

          const { uploadService } = await import('@/lib/services/upload.service');

          let proofUrl: string | undefined;
          let proofUrls: string[] | undefined;
          if (proofImages.length > 0) {
            const urls = await uploadService.uploadMultiple(proofImages, { category: 'proofs' });
            proofUrls = urls;
            proofUrl = urls[0];
          }

          const memberId_ =
            typeof record.teamMemberId === 'string'
              ? record.teamMemberId
              : (record.teamMemberId as { _id: string })?._id;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = {
            ...(record._id ? { salaryId: record._id } : {}),
            ...(memberId_ ? { teamMemberId: memberId_ } : {}),
            month: record.month,
            year: record.year,
            amount,
            paymentMode:
              splitMode === 'split'
                ? 'split'
                : singlePaymentMethod === 'upi'
                  ? 'upi'
                  : singlePaymentMethod === 'bank_transfer'
                    ? 'bank_transfer'
                    : singlePaymentMethod === 'cheque'
                      ? 'cheque'
                      : 'cash',
            paymentDate,
            referenceNo: vals.referenceNo,
            transactionId: vals.transactionId,
            voucherNo: vals.voucherNo,
            note: vals.note,
            paymentFrom: vals.paymentFrom,
            paidBy: vals.paidBy,
            proofAttached: proofImages.length > 0,
            proofUrl,
            proofUrls,
            ...(addCommission && commissionAmount > 0
              ? {
                  commission: commissionAmount,
                  commissionNote: commissionNote || undefined,
                  commissionTitle: commissionTitle || undefined,
                }
              : {}),
            ...(localIsAdvance ? { advanceTarget } : {}),
            ...(localIsAdvance &&
            advanceTarget === 'next_month' &&
            advanceInstallmentValue != null &&
            ((advanceInstallmentValue.mode === 'count' &&
              (advanceInstallmentValue.installmentCount ?? 0) > 1) ||
              (advanceInstallmentValue.mode === 'amount' &&
                (advanceInstallmentValue.installmentAmount ?? 0) > 0))
              ? {
                  advanceInstallments: {
                    ...(advanceInstallmentValue.mode === 'count'
                      ? { installmentCount: advanceInstallmentValue.installmentCount }
                      : { installmentAmount: advanceInstallmentValue.installmentAmount }),
                  },
                }
              : {}),
            ...(extra?.overrideCompliance ? { overrideCompliance: true } : {}),
            ...(extra?.overrideCompliance && extra?.overrideReason
              ? { overrideReason: extra.overrideReason }
              : {}),
          };

          if (splitMode === 'split') {
            const allProofUrls = await Promise.all(
              splits.map((s) =>
                s.proofFiles.length > 0
                  ? uploadService.uploadMultiple(s.proofFiles, { category: 'proofs' })
                  : Promise.resolve([] as string[]),
              ),
            );
            payload.splitLines = splits
              .filter((s) => s.amount > 0)
              .map((s) => {
                const originalIdx = splits.indexOf(s);
                return {
                  method: s.method,
                  amount: s.amount,
                  transactionId: s.transactionId || undefined,
                  voucherNo: s.voucherNo || undefined,
                  referenceNo: s.referenceNo || undefined,
                  paymentFrom: s.paymentFrom || undefined,
                  paidBy: s.paidBy || undefined,
                  dateTime: s.payoutDate,
                  note: s.internalNotes || undefined,
                  proofUrls: allProofUrls[originalIdx] || undefined,
                };
              });
            payload.amount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
          }

          await recordSalaryPayment(workspaceId, payload);
          msgApi.success('Payment recorded');
          closePay();
          onChanged?.();
        } catch (e) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errBody = (e as any)?.response?.data ?? (e as any)?.data;
          if (errBody?.code === 'COMPLIANCE_BLOCKED' && Array.isArray(errBody?.breaches)) {
            setPendingComplianceBreaches(errBody.breaches as AdvanceComplianceBreach[]);
            msgApi.error(
              'Payment blocked: compliance requirements not met. Review breaches and override if authorised.',
            );
          } else {
            msgApi.error(parseApiError(e));
          }
        } finally {
          setSaving(false);
        }
      })();
    },
    [
      workspaceId,
      record,
      isHydrated,
      payForm,
      splitMode,
      splits,
      proofImages,
      singlePaymentMethod,
      addCommission,
      commissionAmount,
      commissionNote,
      commissionTitle,
      advanceTarget,
      advanceInstallmentValue,
      closePay,
      onChanged,
      msgApi,
    ],
  );

  const getSalaryBasisMeta = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (member: any): { label: string; detail: string } | null => {
      if (!member) return null;
      const defaultWorkingDays = Math.max(
        1,
        Math.min(31, Number(payrollDisplay?.defaultWorkingDays ?? 26) || 26),
      );
      const rec_ = record;
      const month_ = rec_?.month ?? dayjs().month() + 1;
      const year_ = rec_?.year ?? dayjs().year();
      const monthLength = dayjs(`${year_}-${String(month_).padStart(2, '0')}-01`).daysInMonth();
      const basisDays =
        member.salaryDayBasis === 'calendar_month_days'
          ? monthLength
          : (member.fixedMonthDays ?? member.workingDays ?? defaultWorkingDays);
      const dayBasisLabel =
        member.salaryDayBasis === 'calendar_month_days'
          ? `calendar ${basisDays}-day basis`
          : `fixed ${basisDays}-day basis`;
      const attendanceLabel =
        member.attendancePayMode === 'enabled'
          ? 'attendance based'
          : member.attendancePayMode === 'disabled'
            ? 'attendance ignored'
            : 'workspace attendance default';

      if ((member.salaryType || 'monthly') !== 'hourly') {
        if (member.ctcAmount && member.componentTemplateId) {
          return {
            label: 'Monthly + Structure',
            detail: `Monthly compensation derived from CTC and a salary structure using ${dayBasisLabel} (${attendanceLabel})`,
          };
        }
        return {
          label: 'Monthly',
          detail: `Fixed monthly base pay using ${dayBasisLabel} (${attendanceLabel})`,
        };
      }

      const hourlyRate = formatCurrencyFull(member.salaryAmount ?? 0);
      const dailyHours = member.dailyHours ?? 0;
      if (member.finalMonthlyOverride !== undefined && member.finalMonthlyOverride !== null) {
        return {
          label: 'Hourly + Override',
          detail: `Time-based pay: ${hourlyRate}/hr x ${dailyHours} hrs x ${dayBasisLabel}, overridden to ${formatCurrencyFull(member.finalMonthlyOverride)} (${attendanceLabel})`,
        };
      }
      return {
        label: 'Time-based Pay',
        detail: `Time-based pay: ${hourlyRate}/hr x ${dailyHours} hrs x ${dayBasisLabel} (${attendanceLabel})`,
      };
    },
    [payrollDisplay, record, formatCurrencyFull],
  );

  // Derived amounts
  const payable = record
    ? record.isPreview
      ? (record.effectiveSalary ?? record.baseSalary ?? 0)
      : (record.netSalary ?? 0)
    : 0;
  const rawDue = payable - (record?.paidAmount ?? 0);
  const dueAmount = Math.max(0, rawDue);
  const advancePaidAmount = rawDue < 0 ? Math.abs(rawDue) : 0;
  const totalSplitAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);

  void currentWorkspace;

  return {
    open,
    openPay,
    closePay,
    record,
    fetching,
    payForm,
    saving,
    splitMode,
    setSplitMode,
    splits,
    setSplits,
    singlePaymentMethod,
    setSinglePaymentMethod,
    sameDateForAll,
    setSameDateForAll,
    samePaidByForAll,
    setSamePaidByForAll,
    sameNotesForAll,
    setSameNotesForAll,
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
    advanceInstallmentValue,
    setAdvanceInstallmentValue,
    proofImages,
    setProofImages,
    outstandingAdvance,
    payPreferredMethod,
    pendingComplianceBreaches,
    dueAmount,
    advancePaidAmount,
    totalSplitAmount,
    canSplit,
    canAdvance,
    formatCurrencyFull,
    formatPayrollDayValue,
    getSalaryBasisMeta,
    submitPayment,
    msgApi,
  };
}
