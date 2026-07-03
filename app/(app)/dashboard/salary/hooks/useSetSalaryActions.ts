import { useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { useSalaryPageStore } from '../store/useSalaryPageStore';
import { setBasePay } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import type { SalaryRecord } from '../types/salary-page.types';
import type { MessageInstance } from 'antd/es/message/interface';
import type {
  EmployeeComponentOverride,
  SetBasePayBankDetailsPayload,
  SetBasePaySalaryConfigPayload,
  SetBasePayUpiDetailsPayload,
} from '@/types';

interface SetSalaryFormValues {
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
  ctcAmount?: number | null;
  componentTemplateId?: string | null;
  componentOverrides?: EmployeeComponentOverride[];
}

interface UseSetSalaryActionsDeps {
  setSalaryModal: SalaryRecord | null;
  getRecordStatus: (record: SalaryRecord) => string;
  load: () => Promise<unknown>;
  msgApi: MessageInstance;
}

export function useSetSalaryActions(deps: UseSetSalaryActionsDeps) {
  const { setSalaryModal, getRecordStatus, load, msgApi } = deps;
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isHydrated = useWorkspaceStore((state) => state.isHydrated);
  const setSetSalaryModal = useSalaryPageStore((state) => state.setSetSalaryModal);

  const [saving, setSaving] = useState(false);

  const handleSetSalary = useCallback(
    async (opts: {
      vals: SetSalaryFormValues;
      salaryMode: 'monthly' | 'hourly';
      paymentMethod?: 'UPI' | 'BANK';
      sameAsEmployeeName: boolean;
      passbookImage: string | File | null;
      qrCodeImage: string | File | null;
      setPassbookImage: (v: string | File | null) => void;
      setQrCodeImage: (v: string | File | null) => void;
      ctcAmount: number | null;
      selectedTemplateId: string | null;
      componentOverrides: EmployeeComponentOverride[];
    }) => {
      const {
        vals,
        salaryMode,
        paymentMethod,
        sameAsEmployeeName,
        passbookImage,
        qrCodeImage,
        setPassbookImage,
        setQrCodeImage,
        ctcAmount,
        selectedTemplateId,
        componentOverrides,
      } = opts;

      if (!currentWorkspaceId || !setSalaryModal || !isHydrated) return;
      const isSalaryNotSet = getRecordStatus(setSalaryModal) === 'salary_not_set';
      setSaving(true);
      try {
        const memberId =
          typeof setSalaryModal.teamMemberId === 'string'
            ? setSalaryModal.teamMemberId
            : setSalaryModal.teamMemberId?._id || setSalaryModal.teamMember?.id;
        const payrollConfig = usePayrollConfigStore.getState().config;
        const configWorkingDays = payrollConfig?.display?.defaultWorkingDays || 26;
        const monthLength = dayjs()
          .year(setSalaryModal.year)
          .month(setSalaryModal.month - 1)
          .daysInMonth();
        const salaryDayBasis =
          vals.salaryDayBasis === 'calendar_month_days'
            ? 'calendar_month_days'
            : 'fixed_month_days';
        const normalizedFixedMonthDays =
          salaryDayBasis === 'fixed_month_days'
            ? Math.max(
                1,
                Math.min(31, Number(vals.fixedMonthDays ?? configWorkingDays) || configWorkingDays),
              )
            : null;
        const resolvedBasisDays =
          salaryDayBasis === 'calendar_month_days'
            ? monthLength
            : (normalizedFixedMonthDays ?? configWorkingDays);
        const attendancePayMode =
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
            const uploaded = await uploadService.uploadSingle(passbookImage, {
              category: 'proofs',
            });
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

        const accountHolder = sameAsEmployeeName
          ? setSalaryModal.teamMember?.name || ''
          : vals.accountHolderName || '';

        if (memberId) {
          const commonSalaryConfig: {
            salaryDayBasis: 'fixed_month_days' | 'calendar_month_days';
            fixedMonthDays?: number | null;
            attendancePayMode: 'default' | 'enabled' | 'disabled';
            preferredMethod?: 'BANK' | 'UPI';
            upiDetails?: SetBasePayUpiDetailsPayload;
            bankDetails?: SetBasePayBankDetailsPayload;
          } = {
            salaryDayBasis,
            attendancePayMode,
            ...(salaryDayBasis === 'fixed_month_days'
              ? { fixedMonthDays: normalizedFixedMonthDays }
              : {}),
            ...(vals.preferredPayoutMethod
              ? { preferredMethod: vals.preferredPayoutMethod as 'BANK' | 'UPI' }
              : {}),
            ...(paymentMethod === 'UPI' && vals.upiId
              ? {
                  upiDetails: {
                    upiId: vals.upiId,
                    qrCodeUrl: qrCodeImageUrl || setSalaryModal.teamMember?.upiDetails?.qrCodeUrl,
                  },
                }
              : {}),
            ...(paymentMethod === 'BANK' && vals.bankName
              ? {
                  bankDetails: {
                    bankName: vals.bankName,
                    accountHolderName: accountHolder,
                    accountNumber: vals.accountNumber || '',
                    ifscCode: vals.ifscCode || '',
                    passbookImageUrl:
                      passbookImageUrl || setSalaryModal.teamMember?.bankDetails?.passbookImageUrl,
                  },
                }
              : {}),
          };

          const salaryConfig: SetBasePaySalaryConfigPayload =
            salaryMode === 'hourly'
              ? {
                  salaryAmount: vals.hourlyRate || 0,
                  salaryType: 'hourly',
                  finalMonthlyOverride: vals.finalMonthlyOverride ?? null,
                  ...(vals.dailyHours !== undefined ? { dailyHours: vals.dailyHours } : {}),
                  ...commonSalaryConfig,
                }
              : {
                  salaryAmount: vals.baseSalary,
                  salaryType: 'monthly',
                  ctcAmount: ctcAmount ?? null,
                  componentTemplateId: selectedTemplateId ?? null,
                  componentOverrides: componentOverrides ?? [],
                  ...commonSalaryConfig,
                };

          const salaryRecordUpdate = setSalaryModal._id
            ? { salaryId: setSalaryModal._id, baseSalary: finalSalary }
            : undefined;

          await setBasePay(currentWorkspaceId, memberId, salaryConfig, salaryRecordUpdate);
        }
      } catch (e) {
        setSaving(false);
        msgApi.error(parseApiError(e));
        return;
      }

      msgApi.success(isSalaryNotSet ? 'Salary set successfully' : 'Salary updated successfully');
      setSetSalaryModal(null);
      setPassbookImage(null);
      setQrCodeImage(null);
      setSaving(false);
      load();
    },
    [
      currentWorkspaceId,
      isHydrated,
      setSalaryModal,
      getRecordStatus,
      load,
      msgApi,
      setSetSalaryModal,
    ],
  );

  return {
    handleSetSalary,
    saving,
    setSaving,
  };
}
