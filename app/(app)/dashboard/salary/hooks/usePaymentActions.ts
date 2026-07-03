import { useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { recordSalaryPayment } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useSalaryPageStore } from '../store/useSalaryPageStore';
import type {
  SalaryRecord,
  RecordSalaryPaymentPayload,
  AdvanceComplianceBreach,
} from '../types/salary-page.types';
import type { AdvanceInstallmentValue } from '../components/salary/AdvanceInstallmentConfigurator';
import type { MessageInstance } from 'antd/es/message/interface';
import dayjs from 'dayjs';

interface SplitLine {
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

interface PaymentFormValues {
  amount?: number;
  paymentDate?: dayjs.Dayjs;
  note?: string;
  transactionId?: string;
  voucherNo?: string;
  referenceNo?: string;
  paymentFrom?: string;
  paidBy?: string;
}

interface UsePaymentActionsDeps {
  load: () => Promise<unknown>;
  msgApi: MessageInstance;
  /**
   * Called when the backend returns COMPLIANCE_BLOCKED on a submit attempt
   * without an override (race / stale preview). The parent should surface
   * the breaches and open the override modal.
   */
  onComplianceBlocked?: (breaches: AdvanceComplianceBreach[]) => void;
}

export function usePaymentActions(deps: UsePaymentActionsDeps) {
  const { load, msgApi, onComplianceBlocked } = deps;
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isHydrated = useWorkspaceStore((state) => state.isHydrated);
  const setPayModal = useSalaryPageStore((state) => state.setPayModal);

  const [saving, setSaving] = useState(false);
  const [reversePaymentSaving, setReversePaymentSaving] = useState(false);

  const handlePayment = useCallback(
    async (opts: {
      vals: PaymentFormValues;
      payModal: SalaryRecord;
      splitMode: 'single' | 'split';
      splits: SplitLine[];
      proofImages: File[];
      singlePaymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
      addCommission: boolean;
      commissionAmount: number;
      commissionNote: string;
      commissionTitle: string;
      advanceTarget: 'next_month' | 'this_month';
      advanceInstallmentValue?: AdvanceInstallmentValue | null;
      overrideCompliance?: boolean;
      overrideReason?: string;
      /** COA cash/bank account selected in Pay drawer (D-10). Forwarded to backend for ledger posting (Plan 26-04). */
      coaAccountId?: string;
    }) => {
      const {
        vals,
        payModal,
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
        overrideCompliance,
        overrideReason,
        coaAccountId,
      } = opts;

      if (!currentWorkspaceId) {
        msgApi.error('No workspace selected');
        return;
      }
      if (!payModal) {
        msgApi.error('No employee selected for payment');
        return;
      }
      if (!isHydrated) {
        msgApi.error('App not ready');
        return;
      }

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
      try {
        const memberId =
          typeof payModal.teamMemberId === 'string'
            ? payModal.teamMemberId
            : payModal.teamMemberId._id;
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

        const payableAmount = payModal.isPreview
          ? (payModal.effectiveSalary ?? payModal.baseSalary ?? 0)
          : (payModal.netSalary ?? 0);
        // localIsAdvance: the entered amount exceeds what is still owed, meaning there is a surplus.
        // Mirrors the frontend's projectedCurrentMonthExcess = max(0, amount - dueAmount).
        const remainingDue = Math.max(0, payableAmount - (payModal.paidAmount ?? 0));
        const localIsAdvance = amount > remainingDue;
        const payload: RecordSalaryPaymentPayload = {
          ...(payModal._id ? { salaryId: payModal._id } : {}),
          ...(memberId ? { teamMemberId: memberId } : {}),
          month: payModal.month,
          year: payModal.year,
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
          ...(overrideCompliance ? { overrideCompliance: true } : {}),
          ...(overrideCompliance && overrideReason ? { overrideReason } : {}),
          // D-10: COA account selected in Pay drawer - forwarded to backend for ledger posting.
          // Backend validates account membership + type (Plan 26-04 resolveCreditAccount).
          ...(coaAccountId ? { coaAccountId } : {}),
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

          const splitTotal = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
          payload.amount = splitTotal;
        }

        await recordSalaryPayment(currentWorkspaceId, payload);
      } catch (e) {
        setSaving(false);
        // Check for a COMPLIANCE_BLOCKED response (race / stale preview).
        // If the backend blocked the submission due to compliance breaches, surface
        // the breaches via the callback so the parent can open the override modal.
        const errBody = (e as any)?.response?.data ?? (e as any)?.data;
        if (errBody?.code === 'COMPLIANCE_BLOCKED' && Array.isArray(errBody?.breaches)) {
          if (onComplianceBlocked) {
            onComplianceBlocked(errBody.breaches as AdvanceComplianceBreach[]);
          } else {
            msgApi.error(parseApiError(e));
          }
        } else {
          msgApi.error(parseApiError(e));
        }
        return;
      }

      msgApi.success('Payment recorded');
      setPayModal(null);
      setSaving(false);
      load();
    },
    [currentWorkspaceId, isHydrated, setPayModal, load, msgApi, onComplianceBlocked],
  );

  const handleReversePayment = useCallback(
    async (opts: {
      vals: { reversalReason: string };
      reversePaymentTarget: { id: string };
      monthTransactionsModal: { record: SalaryRecord };
      openLedger: (rec: SalaryRecord) => Promise<void>;
    }): Promise<boolean> => {
      const { vals, reversePaymentTarget, monthTransactionsModal, openLedger } = opts;
      if (!currentWorkspaceId || !reversePaymentTarget || !monthTransactionsModal) return false;
      setReversePaymentSaving(true);
      try {
        const { reverseSalaryPayment } = await import('@/lib/actions');
        await reverseSalaryPayment(currentWorkspaceId, reversePaymentTarget.id, {
          reversalReason: vals.reversalReason.trim(),
        });
        msgApi.success('Payment reversed');
        await openLedger(monthTransactionsModal.record);
        load();
        return true;
      } catch (e) {
        msgApi.error(parseApiError(e));
        return false;
      } finally {
        setReversePaymentSaving(false);
      }
    },
    [currentWorkspaceId, load, msgApi],
  );

  return {
    handlePayment,
    handleReversePayment,
    saving,
    setSaving,
    reversePaymentSaving,
    setReversePaymentSaving,
  };
}
