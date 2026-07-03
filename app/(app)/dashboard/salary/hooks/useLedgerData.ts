import { useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { getSalaryRecords, getSalaryPayments } from '@/lib/actions';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { useSalaryPageStore } from '../store/useSalaryPageStore';
import { getPaymentCreditedAmount } from '../utils/salary-page.utils';
import type {
  SalaryRecord,
  LedgerRecord,
  LedgerMonth,
  LedgerTransaction,
} from '../types/salary-page.types';
import dayjs from 'dayjs';

export function useLedgerData() {
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isHydrated = useWorkspaceStore((state) => state.isHydrated);
  const setMonthTransactionsModal = useSalaryPageStore((state) => state.setMonthTransactionsModal);
  const setLedgerData = useSalaryPageStore((state) => state.setLedgerData);
  const setIsLedgerLoading = useSalaryPageStore((state) => state.setIsLedgerLoading);
  const setLedgerError = useSalaryPageStore((state) => state.setLedgerError);

  const openLedger = useCallback(
    async (rec: SalaryRecord) => {
      setMonthTransactionsModal({ record: rec, monthData: null });
      setLedgerData(null);
      setLedgerError(null);
      if (!currentWorkspaceId || !isHydrated) return;
      setIsLedgerLoading(true);
      try {
        const payments = rec._id ? await getSalaryPayments(currentWorkspaceId, rec._id) : [];

        const salary = rec.netSalary || rec.baseSalary || 0;
        const paid = payments
          .filter((p: any) => (p.status || 'active') !== 'reversed')
          .reduce((sum, p) => sum + getPaymentCreditedAmount(p), 0);
        const monthKey = `${rec.year}-${String(rec.month).padStart(2, '0')}`;
        const monthLabel = dayjs(`${monthKey}-01`).format('MMM YYYY');

        const transactions: LedgerTransaction[] = payments.map((p) => ({
          id: p._id,
          transactionType: 'salary' as const,
          amount: getPaymentCreditedAmount(p),
          commission: p.commission,
          commissionNote: p.commissionNote,
          method: p.paymentMode === 'bank_transfer' ? 'bank' : p.paymentMode,
          dateTime: p.paymentDate,
          recordedBy: 'Admin',
          paidBy: p.paidBy,
          referenceNo: p.referenceNo,
          proofAttached: (p.proofUrls && p.proofUrls.length > 0) || !!p.proofAttached,
          proofUrl: p.proofUrls?.[0],
          proofUrls: p.proofUrls,
          note: p.note,
          paymentFrom: p.paymentFrom,
          splitLines: p.splitLines,
          status: (p as any).status || 'active',
          reversedAt: (p as any).reversedAt,
          reversalReason: (p as any).reversalReason,
        }));

        const monthData: LedgerMonth = {
          salaryId: rec._id ?? '',
          monthKey,
          monthLabel,
          salary,
          status: rec.status,
          baseSalary: rec.baseSalary,
          additions: rec.additions,
          deductions: rec.deductions,
          isLocked: rec.isLocked ?? false,
          paid,
          remaining: salary - paid,
          transactions,
        };

        const memberId =
          typeof rec.teamMemberId === 'string'
            ? rec.teamMemberId
            : (rec.teamMemberId?._id ?? rec.teamMember?.id ?? '');

        setLedgerData({
          employeeId: memberId,
          employeeName: rec.teamMember?.name ?? '',
          employeeCode: rec.teamMember?.designation ?? '',
          employeePhoto: rec.teamMember?.avatar,
          months: [monthData],
          totalSalary: salary,
          totalPaid: paid,
          totalRemaining: salary - paid,
          totalTransactions: payments.length,
        });
        setMonthTransactionsModal({ record: rec, monthData });
      } catch (e) {
        setLedgerError(parseApiError(e));
      } finally {
        setIsLedgerLoading(false);
      }
    },
    [
      currentWorkspaceId,
      isHydrated,
      setMonthTransactionsModal,
      setLedgerData,
      setLedgerError,
      setIsLedgerLoading,
    ],
  );

  const loadFullLedger = useCallback(
    async (rec: SalaryRecord) => {
      if (!currentWorkspaceId || !isHydrated) return;

      const memberId =
        typeof rec.teamMemberId === 'string'
          ? rec.teamMemberId
          : (rec.teamMemberId?._id ?? rec.teamMember?.id ?? '');

      if (!memberId) return;

      setIsLedgerLoading(true);
      setLedgerError(null);
      try {
        const res = await salaryApi.getLedger(currentWorkspaceId, memberId);
        setLedgerData(res as LedgerRecord[] as unknown as LedgerRecord);
      } catch {
        const [allSalaries, allPayments] = await Promise.all([
          Promise.all(
            Array.from({ length: 12 }, (_, i) => {
              const d = dayjs().subtract(i, 'month');
              return getSalaryRecords(currentWorkspaceId, d.month() + 1, d.year());
            }),
          ),
          getSalaryPayments(currentWorkspaceId),
        ]);

        const memberSalaries = allSalaries
          .flat()
          .filter((s) => {
            const sId =
              typeof s.teamMemberId === 'string'
                ? s.teamMemberId
                : String((s.teamMemberId as { _id: string })?._id ?? '');
            return sId === memberId;
          })
          .sort((a, b) => b.year - a.year || b.month - a.month);

        const memberPayments = allPayments.filter((p) => {
          const pId =
            typeof p.teamMemberId === 'string'
              ? p.teamMemberId
              : ((p.teamMemberId as { _id: string })?._id ?? String(p.teamMemberId));
          return pId === memberId;
        });

        const months = memberSalaries.map((salary) => {
          const salaryIdStr = salary._id;
          const salaryMonthKey = `${salary.year}-${String(salary.month).padStart(2, '0')}`;
          const monthPayments = memberPayments.filter((p) => {
            const pSalaryId = typeof p.salaryId === 'string' ? p.salaryId : String(p.salaryId);
            if (pSalaryId && pSalaryId !== 'undefined' && pSalaryId !== 'null') {
              return pSalaryId === salaryIdStr;
            }
            const paymentDate = dayjs(p.paymentDate);
            return (
              `${paymentDate.year()}-${String(paymentDate.month() + 1).padStart(2, '0')}` ===
              salaryMonthKey
            );
          });
          const paid = monthPayments.reduce((sum, p) => sum + getPaymentCreditedAmount(p), 0);
          const net = salary.netSalary || salary.baseSalary || 0;
          return {
            salaryId: salaryIdStr ?? '',
            monthKey: salaryMonthKey,
            monthLabel: dayjs(`${salaryMonthKey}-01`).format('MMM YYYY'),
            salary: net,
            status: salary.status,
            baseSalary: salary.baseSalary,
            additions: salary.additions,
            deductions: salary.deductions,
            isLocked: salary.isLocked ?? false,
            paid,
            remaining: net - paid,
            transactions: monthPayments.map((p) => ({
              id: p._id,
              transactionType: 'salary' as const,
              amount: getPaymentCreditedAmount(p),
              commission: p.commission,
              commissionNote: p.commissionNote,
              method: p.paymentMode === 'bank_transfer' ? 'bank' : p.paymentMode,
              dateTime: p.paymentDate,
              recordedBy: 'Admin',
              paidBy: p.paidBy,
              referenceNo: p.referenceNo,
              proofAttached: (p.proofUrls && p.proofUrls.length > 0) || !!p.proofAttached,
              proofUrl: p.proofUrls?.[0],
              proofUrls: p.proofUrls,
              note: p.note,
              paymentFrom: p.paymentFrom,
              splitLines: p.splitLines,
            })),
          };
        });

        const totalSalary = memberSalaries.reduce(
          (sum, s) => sum + (s.netSalary || s.baseSalary || 0),
          0,
        );
        const totalPaid = memberPayments.reduce((sum, p) => sum + getPaymentCreditedAmount(p), 0);

        setLedgerData({
          employeeId: memberId,
          employeeName: rec.teamMember?.name ?? '',
          employeeCode: rec.teamMember?.designation ?? '',
          employeePhoto: rec.teamMember?.avatar,
          months,
          totalSalary,
          totalPaid,
          totalRemaining: totalSalary - totalPaid,
          totalTransactions: memberPayments.length,
        });
      } finally {
        setIsLedgerLoading(false);
      }
    },
    [currentWorkspaceId, isHydrated, setLedgerData, setIsLedgerLoading, setLedgerError],
  );

  return {
    openLedger,
    loadFullLedger,
  };
}
